# Turns a Tripo GLB into a fight-ready model for js/aikit.js (see README.md in this folder).
#   .\tools\aimodel\make.ps1 -Src C:\Users\jackh\Downloads\norne\<tripo>.glb -Id elf-traveller
# Step 1 (no joints file yet): writes front and side pictures to find the joints from.
# Step 2 (tools\aimodel\<id>.json exists): rigs, animates and writes models\<id>.glb plus a sheet of poses to check.
param(
  [Parameter(Mandatory)][string]$Src,
  [Parameter(Mandatory)][string]$Id,
  [int]$Tris = 14000,
  [int]$Tex = 1024,
  [string]$Blender = ''
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$repo = Resolve-Path (Join-Path $here '..\..')
if (-not $Blender) {
  $Blender = @(Get-ChildItem 'C:\Program Files\Blender Foundation\*\blender.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName)[0]
}
if (-not $Blender -or -not (Test-Path $Blender)) { throw 'Blender not found. Pass -Blender <path to blender.exe>.' }
$work = Join-Path $env:TEMP "norne-aimodel\$Id"
New-Item -ItemType Directory -Force $work | Out-Null
$prep = Join-Path $work 'prep.blend'
& $Blender -b --factory-startup --python (Join-Path $here 'prep.py') -- $Src $prep $Tris
& $Blender -b $prep --python (Join-Path $here 'views.py') -- (Join-Path $work 'view') front,side
$joints = Join-Path $here "$Id.json"
if (-not (Test-Path $joints)) {
  Write-Host "Front and side pictures: $work\view_front_1.png, $work\view_side_1.png"
  Write-Host "Copy elf-traveller.json to $Id.json, fix the joints to match, and run this again."
  exit 0
}
$rig = Join-Path $work 'rig.blend'
& $Blender -b $prep --python (Join-Path $here 'rig.py') -- $rig $joints
$out = Join-Path $repo "models\$Id.glb"
& $Blender -b $rig --python (Join-Path $here 'export.py') -- $out $Tex
& $Blender -b $rig --python (Join-Path $here 'preview.py') -- (Join-Path $work 'pose') 'idle:0,walk:.2,attack:.5,attack:.72,attack:.9,hit:.35,down:.6,down:1.5'
Write-Host "Wrote $out ($([math]::Round((Get-Item $out).Length / 1MB, 2)) MB). Pose pictures: $work\pose_*.png"
Write-Host "Add it to MODELS in js\aikit.js, then check it with tools/aimodel/preview.html?model=$Id"
