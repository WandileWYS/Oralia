# Optional asset regeneration on Windows; the web app uses the generated WAV/JSON files on every OS.
param([string]$SeedPath = 'prisma/content/stories.json', [string]$OutputPath = 'prisma/content/narration.json')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$projectRoot = Split-Path -Parent $PSScriptRoot
$seeds = Get-Content -LiteralPath (Join-Path $projectRoot $SeedPath) -Raw -Encoding UTF8 | ConvertFrom-Json
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$results = @()
try {
    foreach ($seed in $seeds) {
        $voice.SelectVoice($seed.voice)
        $audio = New-Object System.IO.MemoryStream
        $cues = @()
        foreach ($scene in $seed.scenes) {
            $segment = New-Object System.IO.MemoryStream
            try {
                $voice.SetOutputToAudioStream($segment, $format)
                $voice.Speak($scene.text)
                $voice.SetOutputToNull()
                $bytes = $segment.ToArray()
                $start = $audio.Length / 44100.0
                $audio.Write($bytes, 0, $bytes.Length)
                $cues += @{ title = $scene.title; caption = $scene.text; startTime = $start; endTime = $audio.Length / 44100.0 }
            } finally { $segment.Dispose() }
        }
        $destination = Join-Path $projectRoot ('public/media/' + $seed.id + '.wav')
        $file = [System.IO.File]::Create($destination)
        $writer = New-Object System.IO.BinaryWriter($file)
        try {
            $writer.Write([System.Text.Encoding]::ASCII.GetBytes('RIFF'))
            $writer.Write([int](36 + $audio.Length))
            $writer.Write([System.Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
            $writer.Write([int]16)
            $writer.Write([int16]1)
            $writer.Write([int16]1)
            $writer.Write([int]22050)
            $writer.Write([int]44100)
            $writer.Write([int16]2)
            $writer.Write([int16]16)
            $writer.Write([System.Text.Encoding]::ASCII.GetBytes('data'))
            $writer.Write([int]$audio.Length)
            $writer.Write($audio.ToArray())
        } finally { $writer.Dispose(); $audio.Dispose() }
        $results += @{ id = $seed.id; durationSeconds = $cues[-1].endTime; cues = $cues; syntheticVoice = $seed.voice }
    }
    $json = ConvertTo-Json -InputObject $results -Depth 8
    [System.IO.File]::WriteAllText((Join-Path $projectRoot $OutputPath), $json, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output ('Generated ' + $results.Count + ' legacy editorial narrations with measured cue timings.')
} finally { $voice.Dispose() }
