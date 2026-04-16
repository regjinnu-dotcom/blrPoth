import re

with open("app.js", "r") as f:
    content = f.read()

# 1. State changes
content = content.replace("constituencies: window.BLR_POTHOLE_SEED.constituencies,", "")

# 2. Select element
content = content.replace('constituencySelectEl = document.getElementById("constituency-select");', 'wardSelectEl = document.getElementById("ward-select");')

# 3. populateConstituencySelect -> populateWardSelect
old_pop = """  function populateConstituencySelect() {
    constituencySelectEl.innerHTML = state.constituencies
      .map(
        (constituency) =>
          `<option value="${constituency.id}">${escapeHtml(constituency.name)} - ${escapeHtml(
            constituency.mla
          )}</option>`
      )
      .join("");
  }"""
new_pop = """  function populateWardSelect() {
    if (!wardSelectEl) return;
    wardSelectEl.innerHTML = '<option value="" disabled selected>Select Ward...</option>' + window.BBMP_WARDS
      .sort((a,b) => a.name.localeCompare(b.name))
      .map((ward) => `<option value="${ward.id}">${escapeHtml(ward.name)}</option>`)
      .join("");
  }"""
content = content.replace(old_pop, new_pop)

content = content.replace('populateConstituencySelect();', 'populateWardSelect();')

# 4. Form fields
content = content.replace('constituencyId: String(formData.get("constituencyId") || ""),', 'wardId: String(formData.get("wardId") || ""),')

# 5. getConstituency -> getWard
old_get = """  function getConstituency(id) {
    return state.constituencies.find((constituency) => constituency.id === id) || state.constituencies[0];
  }"""
new_get = """  function getWard(id) {
    return window.BBMP_WARDS.find((w) => w.id === id) || window.BBMP_WARDS[0];
  }"""
content = content.replace(old_get, new_get)

# 6. buildConstituencySummary -> buildWardSummary
old_build = """  function buildConstituencySummary(constituency) {
    const constituencyReports = state.reports.filter((report) => report.constituencyId === constituency.id);
    const unresolvedReports = constituencyReports.filter((report) => report.status !== "fixed");

    const score = unresolvedReports.reduce((acc, report) => acc + severityWeight[report.severity], 0);

    return {
      ...constituency,
      totalReports: constituencyReports.length,
      openReports: unresolvedReports.length,
      score,
      topArea: constituencyReports[0] ? constituencyReports[0].title : "no reports yet",
    };
  }"""
new_build = """  function buildWardSummary(ward) {
    const wardReports = state.reports.filter((report) => report.wardId === ward.id);
    const unresolvedReports = wardReports.filter((report) => report.status !== "fixed");

    const score = unresolvedReports.reduce((acc, report) => acc + severityWeight[report.severity], 0);

    return {
      ...ward,
      totalReports: wardReports.length,
      openReports: unresolvedReports.length,
      score,
      topArea: wardReports[0] ? wardReports[0].title : "no reports yet",
    };
  }"""
content = content.replace(old_build, new_build)

# 7. Mass generic replacements for "constituencyId"
content = content.replace('report.constituencyId', 'report.wardId')
content = content.replace('constituency_id:', 'ward_id:')
content = content.replace('report.constituency_id || "mahadevapura"', 'report.ward_id || "W1"')
content = content.replace('report.constituency_id', 'report.ward_id')
content = content.replace('constituencyId,', 'wardId,')
content = content.replace('constituency_id,', 'ward_id,')
content = content.replace('constituencyName:', 'wardName:')

# 8. All the small usages
content = content.replace('getConstituency(report.constituencyId)', 'getWard(report.wardId)')
content = content.replace('getConstituency(report.wardId)', 'getWard(report.wardId)')
content = content.replace('buildConstituencySummary(constituency)', 'buildWardSummary(ward)')
content = content.replace('buildConstituencySummary', 'buildWardSummary')

content = content.replace('const constituency = getWard', 'const ward = getWard')
content = content.replace('constituency.name', 'ward.name')
content = content.replace('constituency.id', 'ward.id')
content = content.replace('constituency.zone', 'ward.zone')
content = content.replace('constituency.mla', 'ward.mla')
content = content.replace('constituency.party', 'ward.party')

content = content.replace('openBottomSheet(report, constituency)', 'openBottomSheet(report, ward)')
content = content.replace('const cSummary = buildWardSummary(constituency);', 'const cSummary = buildWardSummary(ward);')
content = content.replace('const cSummary = buildWardSummary(ward);', 'const cSummary = buildWardSummary(ward);')

content = content.replace('.map((constituency) => buildWardSummary(constituency))', '.map((ward) => buildWardSummary(ward))')
content = content.replace('window.BBMP_WARDS.map((ward) => buildWardSummary(ward))', 'window.BBMP_WARDS.map((ward) => buildWardSummary(ward))')
# Wait, constituencyGrid needs window.BBMP_WARDS !
old_render_grid = """    const cards = state.constituencies
      .map((ward) => buildWardSummary(ward))"""
new_render_grid = """    const cards = window.BBMP_WARDS
      .map((ward) => buildWardSummary(ward))"""
content = content.replace(old_render_grid, new_render_grid)

# 9. Dashboard metrics
content = content.replace('new Set(reports.map((report) => report.wardId)).size', 'new Set(reports.map((report) => report.wardId)).size')
content = content.replace('metricCard(constituencyCoverage, "constituencies affected")', 'metricCard(constituencyCoverage, "wards affected")')

with open("app.js", "w") as f:
    f.write(content)
print("Updated app.js successfully.")
