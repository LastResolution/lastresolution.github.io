[CmdletBinding()]
param([switch]$Staged, [string]$Package = '')

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if ($Staged -and $Package) { throw 'Choose staged files or a package, not both.' }

function Read-GitBytes([string[]]$Arguments) {
    $start = [Diagnostics.ProcessStartInfo]::new('git')
    $start.WorkingDirectory = $repoRoot
    $start.UseShellExecute = $false
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::Start($start)
    $stream = [IO.MemoryStream]::new()
    try {
        $process.StandardOutput.BaseStream.CopyTo($stream)
        $errorText = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) { throw "Git privacy inspection failed: $errorText" }
        return ,$stream.ToArray()
    }
    finally { $stream.Dispose(); $process.Dispose() }
}

if ($Staged) {
    foreach ($identity in @('GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT')) {
        $value = [Text.Encoding]::UTF8.GetString((Read-GitBytes @('var', $identity))).Trim()
        $match = [regex]::Match($value, '<(?<email>[^<>]+)>')
        if (-not $match.Success -or $match.Groups['email'].Value -notmatch '^[^@]+@users\.noreply\.github\.com$') {
            throw 'Configure GitHub noreply author and committer addresses before committing. See CONTRIBUTING.md. Addresses are not printed.'
        }
    }
}
$patterns = [ordered]@{
    'GitHub token' = '(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})'
    'private key' = '-----BEGIN (?:(?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY|PGP PRIVATE KEY BLOCK)-----'
    'AWS access key' = 'AKIA[0-9A-Z]{16}'
    'OpenAI key' = '(?<![A-Za-z0-9_-])sk-(?:(?:proj-|svcacct-)[A-Za-z0-9_-]{40,}|[A-Za-z0-9]{40,})(?![A-Za-z0-9_-])'
    'Slack token' = 'xox[baprs]-[A-Za-z0-9-]{20,}'
    'Google API key' = 'AIza[0-9A-Za-z_-]{35}'
    'credential assignment' = '(?i)(?:password|access_token|api_key)\s*[=:]\s*[\x22\x27][A-Za-z0-9_/+=.-]{20,}[\x22\x27]'
    'personal Windows path' = '(?i)[A-Z]:[\\/]+Users[\\/]+(?!Public[\\/]|Default[\\/]|[<{$%])[^\\/\r\n\x22\x27<> {}$%]+'
}
$findings = [Collections.Generic.List[string]]::new()
function Test-PrivateBytes([byte[]]$Bytes, [string]$DisplayPath) {
    if ($DisplayPath -match '(?i)\.zip$') {
        $memory = [IO.MemoryStream]::new($Bytes, $false)
        try {
            $profileArchive = [IO.Compression.ZipArchive]::new($memory, [IO.Compression.ZipArchiveMode]::Read)
            try {
                if (@($profileArchive.Entries | Where-Object { $_.FullName -ieq 'ReStart-backup.json' }).Count) {
                    $findings.Add("$DisplayPath — private profile backup archive")
                }
            } finally { $profileArchive.Dispose() }
        } catch [IO.InvalidDataException] { }
        finally { $memory.Dispose() }
    }
    if ($DisplayPath -match '(?i)\.(?:pfx|p12|p8|pvk|snk|key|jks|keystore)$') {
        $findings.Add("$DisplayPath — private signing container")
    }
    $raw = [Text.Encoding]::UTF8.GetString($Bytes)
    # Normalize complete UTF-16 ASCII runs, retaining string terminators. Removing
    # every NUL would join unrelated binary string-table entries into false keys.
    $content = [regex]::Replace($raw, '(?:[\x09\x0A\x0D\x20-\x7E]\x00){6,}',
        [Text.RegularExpressions.MatchEvaluator]{ param($match) $match.Value.Replace([string][char]0, '') })
    foreach ($pattern in $patterns.GetEnumerator()) {
        if ([regex]::IsMatch($content, $pattern.Value)) { $findings.Add("$DisplayPath — $($pattern.Key)") }
    }
}
if ($Package) {
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Package).Path)
    $fileCount = 0
    try {
        foreach ($entry in $archive.Entries) {
            if (-not $entry.Name) { continue }
            if ($entry.Length -gt 256MB) { throw 'A package entry exceeds the privacy inspection bound.' }
            $fileCount++
            $inputStream = $entry.Open(); $buffer = [IO.MemoryStream]::new()
            try { $inputStream.CopyTo($buffer); Test-PrivateBytes $buffer.ToArray() $entry.FullName }
            finally { $inputStream.Dispose(); $buffer.Dispose() }
        }
    }
    finally { $archive.Dispose() }
}
else {
    $arguments = if ($Staged) { @('diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR') } else { @('ls-files', '-z') }
    $paths = [Text.Encoding]::UTF8.GetString((Read-GitBytes $arguments)).Split([char]0, [StringSplitOptions]::RemoveEmptyEntries)
    $fileCount = $paths.Count
    foreach ($path in $paths) {
        $bytes = if ($Staged) { Read-GitBytes @('show', ":$path") } else { [IO.File]::ReadAllBytes((Join-Path $repoRoot $path)) }
        Test-PrivateBytes $bytes $path
    }
}
if ($findings.Count -gt 0) {
    $findings | ForEach-Object { Write-Output $_ }
    throw 'Privacy checks failed. Remove the finding before committing; matched values are not printed.'
}
Write-Output "Privacy patterns checked in $fileCount files."
