<#
.SYNOPSIS
  Convert an .xlsx worksheet to JSON (or CSV) with ZERO external dependencies.
  An .xlsx file is a ZIP of XML parts, so this reads it with .NET's built-in
  System.IO.Compression — no Excel, no Python, no PowerShell modules required.

.DESCRIPTION
  Used by the /present skill to turn spreadsheet data into charts locally.
  Data never leaves the machine.

  Handles: shared strings, inline strings, numbers, booleans, and dates
  (Excel serial numbers are converted to ISO-8601 using the workbook's date system).

.PARAMETER Path      Path to the .xlsx file (required).
.PARAMETER Sheet     Sheet name to read. Default: the first sheet.
.PARAMETER List      List sheet names and exit (no data emitted).
.PARAMETER Mode      'objects' (default) = array of row objects keyed by header row.
                     'grid'              = array of raw row arrays (no header handling).
.PARAMETER NoHeader  In 'objects' mode, treat the first row as data (columns become A,B,C...).
.PARAMETER Out       Write JSON to this file instead of stdout.
.PARAMETER Csv       Emit CSV instead of JSON.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File xlsx-to-json.ps1 -Path sales.xlsx -List
  powershell -ExecutionPolicy Bypass -File xlsx-to-json.ps1 -Path sales.xlsx -Sheet "Q3" -Out q3.json
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Path,
  [string]$Sheet,
  [switch]$List,
  [ValidateSet('objects','grid')][string]$Mode = 'objects',
  [switch]$NoHeader,
  [string]$Out,
  [switch]$Csv
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

if (-not (Test-Path -LiteralPath $Path)) { throw "File not found: $Path" }
$full = (Resolve-Path -LiteralPath $Path).Path

$ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
$rns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

function Get-EntryXml($zip, $name) {
  $entry = $zip.Entries | Where-Object { $_.FullName -eq $name } | Select-Object -First 1
  if (-not $entry) { return $null }
  $sr = New-Object System.IO.StreamReader($entry.Open())
  try { $text = $sr.ReadToEnd() } finally { $sr.Dispose() }
  $xml = New-Object System.Xml.XmlDocument
  $xml.LoadXml($text)
  return $xml
}

function New-NsMgr($xml) {
  $m = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
  $m.AddNamespace('a', $ns)
  $m.AddNamespace('r', $rns)
  return $m
}

# Convert an Excel column reference like "AB12" -> zero-based column index (AB -> 27)
function Convert-ColIndex([string]$ref) {
  $letters = ($ref -replace '[0-9]','')
  $n = 0
  foreach ($ch in $letters.ToCharArray()) { $n = $n * 26 + ([int][char]$ch - 64) }
  return $n - 1
}

function Convert-ColName([int]$idx) {
  $n = $idx + 1; $s = ''
  while ($n -gt 0) { $r = ($n - 1) % 26; $s = [char]([int][char]'A' + $r) + $s; $n = [math]::Floor(($n - 1) / 26) }
  return $s
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($full)
try {
  # --- workbook: sheet list + date system ---------------------------------
  $wb = Get-EntryXml $zip 'xl/workbook.xml'
  if (-not $wb) { throw "Not a valid .xlsx (missing xl/workbook.xml)." }
  $wbm = New-NsMgr $wb

  $date1904 = $false
  $pr = $wb.SelectSingleNode('//a:workbookPr', $wbm)
  if ($pr -and ($pr.GetAttribute('date1904') -in @('1','true'))) { $date1904 = $true }
  $epoch = if ($date1904) { [datetime]'1904-01-01' } else { [datetime]'1899-12-30' }

  # map r:id -> worksheet target path
  $rels = Get-EntryXml $zip 'xl/_rels/workbook.xml.rels'
  $relMap = @{}
  if ($rels) {
    foreach ($rel in $rels.DocumentElement.ChildNodes) {
      $t = $rel.GetAttribute('Target')
      if ($t -notmatch '^/') { $t = 'xl/' + ($t -replace '^\./','') }
      else { $t = $t.TrimStart('/') }
      $relMap[$rel.GetAttribute('Id')] = $t
    }
  }

  $sheets = @()
  foreach ($sh in $wb.SelectNodes('//a:sheets/a:sheet', $wbm)) {
    $rid = $sh.GetAttribute('id', $rns)
    $target = if ($rid -and $relMap.ContainsKey($rid)) { $relMap[$rid] } else { $null }
    $sheets += [pscustomobject]@{ Name = $sh.GetAttribute('name'); Target = $target }
  }
  if ($sheets.Count -eq 0) { throw "No sheets found." }

  if ($List) {
    $sheets | ForEach-Object { $_.Name } | ConvertTo-Json -Compress | Write-Output
    return
  }

  $chosen = if ($Sheet) { $sheets | Where-Object { $_.Name -eq $Sheet } | Select-Object -First 1 }
            else { $sheets[0] }
  if (-not $chosen) { throw "Sheet '$Sheet' not found. Available: $(( $sheets.Name ) -join ', ')" }
  $sheetPath = $chosen.Target
  if (-not $sheetPath) { $sheetPath = 'xl/worksheets/sheet1.xml' }

  # --- shared strings ------------------------------------------------------
  $shared = @()
  $ss = Get-EntryXml $zip 'xl/sharedStrings.xml'
  if ($ss) {
    $ssm = New-NsMgr $ss
    foreach ($si in $ss.SelectNodes('//a:si', $ssm)) {
      # concatenate all descendant <t> (covers rich-text runs)
      $sb = New-Object System.Text.StringBuilder
      foreach ($t in $si.SelectNodes('.//a:t', $ssm)) { [void]$sb.Append($t.InnerText) }
      $shared += $sb.ToString()
    }
  }

  # --- styles: which style indexes are dates -------------------------------
  $dateStyle = @{}
  $st = Get-EntryXml $zip 'xl/styles.xml'
  if ($st) {
    $stm = New-NsMgr $st
    $customFmt = @{}
    foreach ($nf in $st.SelectNodes('//a:numFmts/a:numFmt', $stm)) {
      $customFmt[[int]$nf.GetAttribute('numFmtId')] = $nf.GetAttribute('formatCode')
    }
    $builtinDate = @(14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58)
    $i = 0
    foreach ($xf in $st.SelectNodes('//a:cellXfs/a:xf', $stm)) {
      $fidRaw = $xf.GetAttribute('numFmtId')
      $fid = if ($fidRaw) { [int]$fidRaw } else { 0 }
      $isDate = $false
      if ($builtinDate -contains $fid) { $isDate = $true }
      elseif ($customFmt.ContainsKey($fid)) {
        $code = ($customFmt[$fid] -replace '\[[^\]]*\]','' -replace '"[^"]*"','')  # strip [color]/literals
        if ($code -match '[yYdD]' -or $code -match 'hh|HH|ss|SS|AM/PM') { $isDate = $true }
      }
      $dateStyle[$i] = $isDate
      $i++
    }
  }

  # --- worksheet cells -----------------------------------------------------
  $sheetXml = Get-EntryXml $zip $sheetPath
  if (-not $sheetXml) { throw "Worksheet part not found: $sheetPath" }
  $sm = New-NsMgr $sheetXml

  $rowsOut = New-Object System.Collections.Generic.List[object]
  $maxCol = -1
  foreach ($row in $sheetXml.SelectNodes('//a:sheetData/a:row', $sm)) {
    $cells = @{}
    foreach ($c in $row.SelectNodes('a:c', $sm)) {
      $ref = $c.GetAttribute('r'); if (-not $ref) { continue }
      $ci = Convert-ColIndex $ref
      if ($ci -gt $maxCol) { $maxCol = $ci }
      $t = $c.GetAttribute('t')
      $sIdx = $c.GetAttribute('s')
      $vNode = $c.SelectSingleNode('a:v', $sm)
      $isNode = $c.SelectSingleNode('a:is', $sm)
      $val = $null
      if ($t -eq 's') {
        if ($vNode) { $val = $shared[[int]$vNode.InnerText] }
      } elseif ($t -eq 'inlineStr') {
        if ($isNode) { $tt = $isNode.SelectNodes('.//a:t', $sm); $val = ($tt | ForEach-Object { $_.InnerText }) -join '' }
      } elseif ($t -eq 'str') {
        if ($vNode) { $val = $vNode.InnerText }
      } elseif ($t -eq 'b') {
        if ($vNode) { $val = ($vNode.InnerText -eq '1') }
      } else {
        # numeric (default). Convert to date if the cell's style says so.
        if ($vNode -ne $null -and $vNode.InnerText -ne '') {
          $num = [double]$vNode.InnerText
          $isDate = $false
          if ($sIdx -ne '' -and $sIdx -ne $null) { $k = [int]$sIdx; if ($dateStyle.ContainsKey($k)) { $isDate = $dateStyle[$k] } }
          if ($isDate) {
            $dt = $epoch.AddDays($num)
            $val = if ($dt.TimeOfDay.TotalSeconds -eq 0) { $dt.ToString('yyyy-MM-dd') } else { $dt.ToString('yyyy-MM-ddTHH:mm:ss') }
          } else { $val = $num }
        }
      }
      $cells[$ci] = $val
    }
    $rowsOut.Add($cells)
  }

  # --- shape output --------------------------------------------------------
  function Get-RowArray($cells, $width) {
    $arr = New-Object object[] $width
    for ($j = 0; $j -lt $width; $j++) { $arr[$j] = if ($cells.ContainsKey($j)) { $cells[$j] } else { $null } }
    return ,$arr
  }
  $width = $maxCol + 1
  if ($width -le 0) { $result = @() }
  elseif ($Mode -eq 'grid') {
    $result = @(); foreach ($r in $rowsOut) { $result += ,(Get-RowArray $r $width) }
  } else {
    $headers = @()
    $startRow = 0
    if (-not $NoHeader -and $rowsOut.Count -gt 0) {
      $h = Get-RowArray $rowsOut[0] $width
      for ($j = 0; $j -lt $width; $j++) {
        $name = if ($null -ne $h[$j] -and "$($h[$j])".Trim() -ne '') { "$($h[$j])" } else { Convert-ColName $j }
        $headers += $name
      }
      $startRow = 1
    } else {
      for ($j = 0; $j -lt $width; $j++) { $headers += Convert-ColName $j }
    }
    $result = @()
    for ($ri = $startRow; $ri -lt $rowsOut.Count; $ri++) {
      $arr = Get-RowArray $rowsOut[$ri] $width
      $obj = [ordered]@{}
      for ($j = 0; $j -lt $width; $j++) { $obj[$headers[$j]] = $arr[$j] }
      $result += [pscustomobject]$obj
    }
  }

  # --- emit ----------------------------------------------------------------
  if ($Csv) {
    if ($Mode -eq 'grid') { throw "-Csv requires object mode (omit -Mode grid)." }
    $out = $result | ConvertTo-Csv -NoTypeInformation
    if ($Out) { $out | Set-Content -LiteralPath $Out -Encoding UTF8 } else { $out | Write-Output }
  } else {
    # Force a JSON array even for 0 or 1 rows (ConvertTo-Json collapses single items to an object).
    $count = @($result).Count
    if ($count -eq 0) { $json = '[]' }
    elseif ($count -eq 1) { $json = '[' + ($result[0] | ConvertTo-Json -Depth 6) + ']' }
    else { $json = $result | ConvertTo-Json -Depth 6 }
    if ($Out) { Set-Content -LiteralPath $Out -Value $json -Encoding UTF8; Write-Output "Wrote $count rows to $Out" }
    else { Write-Output $json }
  }
}
finally { $zip.Dispose() }
