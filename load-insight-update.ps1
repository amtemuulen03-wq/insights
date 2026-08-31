param(
    [string]$ProjectPath = (Get-Location).Path,
    [string]$ZipPath = (Join-Path $PSScriptRoot "insight-past-campaigns-update.zip"),
    [switch]$BuildImages
)

$ErrorActionPreference = "Stop"
$ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
$ZipPath = [System.IO.Path]::GetFullPath($ZipPath)

if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) {
    throw "ZIP file not found: $ZipPath"
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath "package.json"))) {
    throw "ProjectPath is not the insight-next project root: $ProjectPath"
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath "backend"))) {
    throw "The backend directory was not found under: $ProjectPath"
}

$TemporaryPath = Join-Path `
    ([System.IO.Path]::GetTempPath()) `
    ("insight-update-" + [guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Path $TemporaryPath | Out-Null

try {
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $TemporaryPath -Force

    $RequiredFiles = @{
        "UPDATE_MANIFEST.txt" = @(
            "INSIGHT_UPDATE_VERSION=2026-08-31-r12"
        )
        "backend\app\repositories\dashboard.py" = @(
            "PERIOD_AD_SPEND_SQL",
            "WHERE DATE_START >= :START_DATE",
            '"adSpend": round(float(period_ad_spend or 0), 2)'
        )
        "backend\app\repositories\campaign_detail.py" = @(
            "youtube_posts AS (",
            "Instagram source column: DESCRIPTION",
            "YouTube source column: TITLE",
            "CAST(p.DESCRIPTION AS VARCHAR2(4000)) AS CAPTION",
            "CAST(p.TITLE AS VARCHAR2(4000)) AS CAPTION",
            "CAST(p.PERMALINK_URL AS VARCHAR2(4000)) AS POST_URL",
            "NVL(s.CLICKS, 0) AS TOTAL_CLICKS",
            "NVL(s.LINK_CLICKS, 0) AS LINK_CLICKS",
            '"totalClicks": total_clicks',
            '"linkClicks": link_clicks',
            '"posts": posts'
        )
        "app\components\campaign-detail-client.tsx" = @(
            "Posts Performance",
            "Platform Spend Distribution",
            "detail.totals.linkClicks",
            "post.totalClicks",
            "showAllPosts",
            "formatCompactMoney(item.spend)"
        )
        "app\components\app-shell.tsx" = @(
            'const APPLICATION_ROOT = "/insights"',
            'function applicationHref(path: string)',
            '<a href={applicationHref("/dashboard/kpi")}',
            '<a href={applicationHref("/dashboard/campaign")}',
            '<a href={applicationHref("/dashboard/okr")}',
            'pathname.startsWith("/dashboard")',
            'bg-[#0F172A]',
            'bg-[#829BEA]',
            'label="CAMPAIGN"',
            'DASHBOARD',
            'DATA SOURCE',
            'label="USER"',
            'label="SETTINGS"',
            'setCollapsed'
        )
        "app\components\password-gate.tsx" = @(
            'fetch(`${applicationBase()}/api/auth`',
            'initialAuthenticated: boolean',
            'if (authenticated) return children',
            'window.location.reload()',
            'Enter the dashboard password to continue.'
        )
        "app\api\auth\route.ts" = @(
            'httpOnly: true',
            'hasValidInsightSession',
            'INSIGHT_COOKIE_NAME',
            'export async function POST(request: NextRequest)'
        )
        "app\lib\insight-auth.ts" = @(
            'process.env.INSIGHT_PASSWORD',
            'export const INSIGHT_COOKIE_NAME = "insight_session"',
            'timingSafeEqual',
            'export function hasValidInsightSession('
        )
        "app\components\campaign-dashboard-page.tsx" = @(
            'from "./dashboard-client"',
            '<DashboardClient',
            'fetchApi<DashboardSummary>'
        )
        "app\dashboard\campaign\page.tsx" = @(
            'from "../../components/campaign-dashboard-page"',
            'export const dynamic = "force-dynamic"'
        )
        "app\page.tsx" = @(
            'redirect("/insights/dashboard/campaign")'
        )
        "app\layout.tsx" = @(
            'import AppShell from "./components/app-shell"',
            'import PasswordGate from "./components/password-gate"',
            'const cookieStore = await cookies()',
            '<PasswordGate initialAuthenticated={initialAuthenticated}>',
            '<AppShell>{children}</AppShell>',
            '</PasswordGate>'
        )
        "public\sidebar\README.txt" = @(
            "marketing-insight-logo-icon.png",
            "campaign-icon-megaphone.png"
        )
    }

    $ForbiddenMarkers = @{
        "backend\app\repositories\campaign_detail.py" = @(
            "NVL(s.LINK_CLICKS, 0) AS CLICKS"
        )
        "app\components\campaign-detail-client.tsx" = @(
            "Publisher Platform Distribution",
            "Meta ad spend by delivery platform."
        )
    }

    Write-Host "Applying Insight update 2026-08-31-r12" -ForegroundColor Yellow

    foreach ($RelativePath in $RequiredFiles.Keys) {
        $ExtractedPath = Join-Path $TemporaryPath $RelativePath
        if (-not (Test-Path -LiteralPath $ExtractedPath -PathType Leaf)) {
            throw "Update ZIP is missing required file: $RelativePath"
        }

        $ExtractedContent = Get-Content -LiteralPath $ExtractedPath -Raw
        foreach ($Marker in $RequiredFiles[$RelativePath]) {
            if (-not $ExtractedContent.Contains($Marker)) {
                throw "Update ZIP contains an outdated $RelativePath. Missing marker: $Marker"
            }
        }

        if ($ForbiddenMarkers.ContainsKey($RelativePath)) {
            foreach ($Marker in $ForbiddenMarkers[$RelativePath]) {
                if ($ExtractedContent.Contains($Marker)) {
                    throw "Update ZIP contains an outdated $RelativePath. Forbidden marker: $Marker"
                }
            }
        }
    }

    foreach ($Item in Get-ChildItem -LiteralPath $TemporaryPath -Force) {
        Copy-Item `
            -LiteralPath $Item.FullName `
            -Destination $ProjectPath `
            -Recurse `
            -Force
    }

    foreach ($RelativePath in $RequiredFiles.Keys) {
        $ExtractedPath = Join-Path $TemporaryPath $RelativePath
        $InstalledPath = Join-Path $ProjectPath $RelativePath

        if (-not (Test-Path -LiteralPath $InstalledPath -PathType Leaf)) {
            throw "Update verification failed. Destination file is missing: $InstalledPath"
        }

        $ExpectedHash = (Get-FileHash -LiteralPath $ExtractedPath -Algorithm SHA256).Hash
        $InstalledHash = (Get-FileHash -LiteralPath $InstalledPath -Algorithm SHA256).Hash
        if ($ExpectedHash -ne $InstalledHash) {
            throw "Update verification failed. Destination file does not match ZIP: $InstalledPath"
        }

        Write-Host "Verified: $InstalledPath" -ForegroundColor Cyan
    }
}
finally {
    Remove-Item -LiteralPath $TemporaryPath -Recurse -Force
}

Write-Host "Insight source updated and verified in: $ProjectPath" -ForegroundColor Green

if ($BuildImages) {
    Push-Location $ProjectPath
    try {
        docker build --pull=false --tag insight-next:latest .
        if ($LASTEXITCODE -ne 0) { throw "Frontend image build failed." }

        docker build --pull=false --tag insight-api:latest .\backend
        if ($LASTEXITCODE -ne 0) { throw "API image build failed." }

        docker save `
            --output .\insight-images.tar `
            insight-next:latest `
            insight-api:latest
        if ($LASTEXITCODE -ne 0) { throw "Docker image export failed." }

        Write-Host "Created: $(Join-Path $ProjectPath 'insight-images.tar')" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "Run again with -BuildImages to build both images and create insight-images.tar."
}
