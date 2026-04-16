(function () {
  const STORAGE_KEY = "blr-pothole-watch-reports";
  const severityWeight = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const bounds = {
    minLat: 12.8,
    maxLat: 13.2,
    minLng: 77.4,
    maxLng: 77.85,
  };

  const state = {
    filters: {
      severity: "all",
      status: "all",
    },
    constituencies: window.BLR_POTHOLE_SEED.constituencies,
    reports: loadReports(),
  };

  const heroMetricsEl = document.getElementById("hero-metrics");
  const mapEl = document.getElementById("report-map");
  const hotspotListEl = document.getElementById("hotspot-list");
  const constituencyGridEl = document.getElementById("constituency-grid");
  const reportsFeedEl = document.getElementById("reports-feed");
  const constituencySelectEl = document.getElementById("constituency-select");
  const reportFormEl = document.getElementById("report-form-element");
  const formMessageEl = document.getElementById("form-message");
  const severityFilterEl = document.getElementById("severity-filter");
  const statusFilterEl = document.getElementById("status-filter");

  init();

  function init() {
    populateConstituencySelect();
    bindEvents();
    render();
  }

  function loadReports() {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(window.BLR_POTHOLE_SEED.reports));
      return [...window.BLR_POTHOLE_SEED.reports];
    }

    try {
      return JSON.parse(stored);
    } catch (error) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(window.BLR_POTHOLE_SEED.reports));
      return [...window.BLR_POTHOLE_SEED.reports];
    }
  }

  function bindEvents() {
    severityFilterEl.addEventListener("change", (event) => {
      state.filters.severity = event.target.value;
      render();
    });

    statusFilterEl.addEventListener("change", (event) => {
      state.filters.status = event.target.value;
      render();
    });

    reportFormEl.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(reportFormEl);

      const report = {
        id: `local-${Date.now()}`,
        title: String(formData.get("title") || "").trim(),
        description: String(formData.get("description") || "").trim(),
        constituencyId: String(formData.get("constituencyId") || ""),
        severity: String(formData.get("severity") || "medium"),
        status: "open",
        lat: Number(formData.get("lat")),
        lng: Number(formData.get("lng")),
        createdAt: new Date().toISOString().slice(0, 10),
      };

      state.reports = [report, ...state.reports];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.reports));
      reportFormEl.reset();
      formMessageEl.textContent = "Report added locally. The dashboard has been refreshed.";
      render();
    });
  }

  function populateConstituencySelect() {
    constituencySelectEl.innerHTML = state.constituencies
      .map(
        (constituency) =>
          `<option value="${constituency.id}">${constituency.name} - ${constituency.mla}</option>`
      )
      .join("");
  }

  function render() {
    const filteredReports = getFilteredReports();
    renderHeroMetrics(filteredReports);
    renderMap(filteredReports);
    renderHotspots(filteredReports);
    renderConstituencies();
    renderFeed();
  }

  function getFilteredReports() {
    return state.reports.filter((report) => {
      const matchesSeverity =
        state.filters.severity === "all" || report.severity === state.filters.severity;
      const matchesStatus = state.filters.status === "all" || report.status === state.filters.status;
      return matchesSeverity && matchesStatus;
    });
  }

  function renderHeroMetrics(reports) {
    const openCount = reports.filter((report) => report.status !== "fixed").length;
    const criticalCount = reports.filter((report) => report.severity === "critical").length;
    const constituencyCoverage = new Set(reports.map((report) => report.constituencyId)).size;

    heroMetricsEl.innerHTML = [
      metricCard(reports.length, "visible reports"),
      metricCard(openCount, "still unresolved"),
      metricCard(criticalCount, "critical damage cases"),
      metricCard(constituencyCoverage, "constituencies affected"),
    ].join("");
  }

  function metricCard(value, label) {
    return `<div class="metric"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  function renderMap(reports) {
    mapEl.innerHTML = reports
      .map((report) => {
        const point = project(report.lat, report.lng);
        const radius = 8 + severityWeight[report.severity] * 4;
        const constituency = getConstituency(report.constituencyId);
        return `
          <g class="map-marker">
            <circle
              cx="${point.x}"
              cy="${point.y}"
              r="${radius}"
              fill="${getSeverityColor(report.severity)}"
              opacity="0.78"
            />
            <circle
              cx="${point.x}"
              cy="${point.y}"
              r="${radius + 8}"
              fill="${getSeverityColor(report.severity)}"
              opacity="0.12"
            />
            <title>${escapeHtml(report.title)} • ${escapeHtml(constituency.name)} • ${escapeHtml(
              report.status
            )}</title>
          </g>
        `;
      })
      .join("");
  }

  function renderHotspots(reports) {
    const clusters = aggregateHotspots(reports)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);

    hotspotListEl.innerHTML = clusters
      .map((cluster) => {
        return `
          <article class="stack-item">
            <h4>${escapeHtml(cluster.label)}</h4>
            <p>${escapeHtml(cluster.summary)}</p>
            <div class="chip-row">
              <span class="chip score">Pressure score ${cluster.score}</span>
              <span class="chip">${cluster.reportCount} reports</span>
              <span class="chip">${escapeHtml(cluster.constituencyName)}</span>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderConstituencies() {
    const cards = state.constituencies
      .map((constituency) => buildConstituencySummary(constituency))
      .sort((left, right) => right.score - left.score);

    constituencyGridEl.innerHTML = cards
      .map((card) => {
        return `
          <article class="constituency-card">
            <p class="eyebrow">${escapeHtml(card.zone)} zone</p>
            <h4>${escapeHtml(card.name)}</h4>
            <p>${escapeHtml(card.mla)} · ${escapeHtml(card.party)}</p>
            <div class="chip-row">
              <span class="chip score">Score ${card.score}</span>
              <span class="chip">${card.openReports} unresolved</span>
              <span class="chip">${card.totalReports} total</span>
            </div>
            <div class="status-bar"><span style="width:${Math.min(card.score * 8, 100)}%"></span></div>
            <p>
              Most pressure in ${escapeHtml(card.topArea)}. Sample wards: ${escapeHtml(
                card.wards.slice(0, 2).join(", ")
              )}.
            </p>
          </article>
        `;
      })
      .join("");
  }

  function renderFeed() {
    const feed = [...state.reports]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 7);

    reportsFeedEl.innerHTML = feed
      .map((report) => {
        const constituency = getConstituency(report.constituencyId);
        return `
          <article class="feed-item">
            <h4>${escapeHtml(report.title)}</h4>
            <p>${escapeHtml(report.description)}</p>
            <p class="stack-meta">
              ${escapeHtml(constituency.name)} · ${capitalize(report.severity)} · ${capitalize(
                report.status
              )} · ${escapeHtml(report.createdAt)}
            </p>
          </article>
        `;
      })
      .join("");
  }

  function buildConstituencySummary(constituency) {
    const constituencyReports = state.reports.filter(
      (report) => report.constituencyId === constituency.id
    );
    const unresolvedReports = constituencyReports.filter((report) => report.status !== "fixed");
    const score = unresolvedReports.reduce(
      (sum, report) => sum + severityWeight[report.severity],
      0
    );

    return {
      ...constituency,
      totalReports: constituencyReports.length,
      openReports: unresolvedReports.length,
      score,
      topArea: constituencyReports[0] ? constituencyReports[0].title : "no reports yet",
    };
  }

  function aggregateHotspots(reports) {
    const grouped = new Map();

    for (const report of reports) {
      const constituency = getConstituency(report.constituencyId);
      const key = `${constituency.id}-${report.title.split(" ").slice(0, 3).join(" ")}`;
      const current = grouped.get(key) || {
        label: report.title,
        constituencyName: constituency.name,
        reportCount: 0,
        score: 0,
        summary: report.description,
      };

      current.reportCount += 1;
      current.score += severityWeight[report.severity];
      grouped.set(key, current);
    }

    return [...grouped.values()];
  }

  function getConstituency(id) {
    return state.constituencies.find((constituency) => constituency.id === id);
  }

  function getSeverityColor(severity) {
    const colors = {
      critical: "#d62828",
      high: "#f77f00",
      medium: "#fcbf49",
      low: "#5fa8d3",
    };
    return colors[severity];
  }

  function project(lat, lng) {
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 860 + 60;
    const y = 620 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 520;
    return { x, y };
  }

  function capitalize(value) {
    return value
      .split("-")
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
