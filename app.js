(function () {
  const STORAGE_KEY = "blr-pothole-watch-reports";
  const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
  const bounds = { minLat: 12.8, maxLat: 13.2, minLng: 77.4, maxLng: 77.85 };


  const state = {
    filters: { severity: "all", status: "all" },
    reports: [],
    pendingPhotos: [],
    supabase: createSupabaseClient(),
  };

  let leafletMap;
  let mapMarkers = null;
  let heatmapLayer = null;

  window.toggleView = function(view) {
    const btnMap = document.getElementById('btn-map');
    const btnList = document.getElementById('btn-list');
    const mapContainer = document.getElementById('report-map');
    const listContainer = document.getElementById('list-container');
    const statsOverlay = document.getElementById('map-stats-overlay');
    
    if (view === 'map') {
      btnMap.classList.add('active');
      btnList.classList.remove('active');
      mapContainer.style.opacity = '1';
      mapContainer.style.visibility = 'visible';
      statsOverlay.style.display = 'flex';
      listContainer.style.display = 'none';
    } else {
      btnMap.classList.remove('active');
      btnList.classList.add('active');
      mapContainer.style.opacity = '0';
      mapContainer.style.visibility = 'hidden';
      statsOverlay.style.display = 'none';
      renderListView();
      listContainer.style.display = 'block';
    }
  };

  function renderListView() {
    const listContainer = document.getElementById('list-container');
    if (!listContainer) return;
    
    const reports = [...state.reports].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if(reports.length === 0) {
      listContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: #a0aec0; font-weight: 600;">No reports match the current filters.</div>';
      return;
    }

    listContainer.innerHTML = reports.map((report) => {
      const ward = getWard(report.wardId);
      let severityColor, bgSeverity, borderSeverity;
      
      if (report.severity === 'critical') {
        severityColor = '#c53030'; bgSeverity = '#fff5f5'; borderSeverity = '#fc8181';
      } else if (report.severity === 'high') {
        severityColor = '#c05621'; bgSeverity = '#fffff0'; borderSeverity = '#f6ad55';
      } else if (report.severity === 'medium') {
        severityColor = '#c05621'; bgSeverity = '#fffff0'; borderSeverity = '#f6ad55';
      } else {
        severityColor = '#2b6cb0'; bgSeverity = '#ebf8ff'; borderSeverity = '#63b3ed';
      }
      
      return `
        <div style="display:flex; padding: 20px 24px; border-bottom: 1px solid rgba(0,0,0,0.06); align-items: flex-start; cursor: pointer;">
          <div style="width: 44px; height: 44px; background: ${bgSeverity}; color: ${severityColor}; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem; margin-right: 16px; border: 1px solid ${borderSeverity}; align-self: flex-start; flex-shrink: 0;">
             1
          </div>
          <div style="flex: 1; padding-right: 12px;">
             <strong style="display:block; font-size:1.1rem; color: #1a202c; font-family: inherit;">${escapeHtml(ward.name)}</strong>
             <span style="font-size:0.85rem; color: #718096; line-height: 1.4; display: block; margin-top: 4px;">${escapeHtml(report.title)}</span>
          </div>
          <div style="text-align: right; flex-shrink: 0; min-width: 80px;">
             <span style="background: ${bgSeverity}; color: ${severityColor}; padding: 4px 10px; border-radius: 99px; font-size: 0.7rem; font-weight: 700; white-space: nowrap;">${capitalize(report.severity)}</span><br>
             <span style="font-size: 0.75rem; color: #a0aec0; margin-top: 6px; display: inline-block;">${escapeHtml(ward.mla)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  const heroMetricsEl = document.getElementById("hero-metrics");
  const mapStatsOverlayEl = document.getElementById("map-stats-overlay");
  const mapEl = document.getElementById("report-map");
  const hotspotListEl = document.getElementById("hotspot-list");
  const constituencyGridEl = document.getElementById("constituency-grid");
  const reportsFeedEl = document.getElementById("reports-feed");
  const wardSelectEl = document.getElementById("ward-select");
  const reportFormEl = document.getElementById("report-form-element");
  const formMessageEl = document.getElementById("form-message");
  
  const sheetEl = document.getElementById("bottom-sheet");
  const sheetCloseBtn = document.getElementById("sheet-close");
  const severityFilterEl = document.getElementById("severity-filter");
  const statusFilterEl = document.getElementById("status-filter");
  const photoInputEl = document.getElementById("photo-input");
  const photoPreviewEl = document.getElementById("photo-preview");
  const locationButtonEl = document.getElementById("location-button");
  const locationMessageEl = document.getElementById("location-message");


  init();

  async function init() {
    populateWardSelect();
    bindEvents();
    await refreshReports();
    initMap();
    render();
  }

  function initMap() {
    leafletMap = L.map("report-map", {
      scrollWheelZoom: false,
      tap: false
    }).setView([12.9716, 77.5946], 11);
    
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; CartoDB",
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(leafletMap);

    mapMarkers = L.layerGroup().addTo(leafletMap);
  }

  function createSupabaseClient() {
    const config = window.BLR_POTHOLE_CONFIG || {};

    if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
      return null;
    }

    return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  async function refreshReports() {
    if (state.supabase) {
      try {
        const { data, error } = await state.supabase
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        state.reports = data.map(normalizeRemoteReport);
        return;
      } catch (error) {
        formMessageEl.textContent = `Live read failed: ${error.message || "unknown error"}. Using local demo data.`;
      }
    }

    state.reports = loadLocalReports();
  }

  function loadLocalReports() {
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

  function persistLocalReports() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.reports));
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

    photoInputEl.addEventListener("change", handlePhotoSelection);
    locationButtonEl.addEventListener("click", handleUseMyLocation);
    reportFormEl.addEventListener("submit", handleSubmit);
    
    if (sheetCloseBtn) {
      sheetCloseBtn.addEventListener("click", () => sheetEl.classList.remove("sheet-open"));
    }
  }

  function populateWardSelect() {
    if (!wardSelectEl) return;
    wardSelectEl.innerHTML = '<option value="" disabled selected>Select Ward...</option>' + window.BBMP_WARDS
      .sort((a,b) => a.name.localeCompare(b.name))
      .map((ward) => `<option value="${ward.id}">${escapeHtml(ward.name)}</option>`)
      .join("");
  }



  function render() {
    const filteredReports = getFilteredReports();
    renderHeroMetrics(filteredReports);
    renderMapStats(filteredReports);
    renderMap(filteredReports);
    renderHotspots(filteredReports);
    renderConstituencies();
    renderFeed();
  }

  function renderHeroMetrics(reports) {
    const openCount = reports.filter((report) => report.status !== "fixed").length;
    const criticalCount = reports.filter((report) => report.severity === "critical").length;
    const constituencyCoverage = new Set(reports.map((report) => report.wardId)).size;

    heroMetricsEl.innerHTML = [
      metricCard(reports.length, "visible reports"),
      metricCard(openCount, "still unresolved"),
      metricCard(criticalCount, "critical damage cases"),
      metricCard(constituencyCoverage, "wards affected"),
    ].join("");
  }

  function renderMapStats(reports) {
    if (!mapStatsOverlayEl) return;
    
    const totalCount = reports.length;
    const activeCount = reports.filter((report) => report.status !== "fixed").length;
    const fixedCount = totalCount - activeCount;

    mapStatsOverlayEl.innerHTML = `
      <div class="stat-item">
        <span class="stat-val" style="color: var(--ink);">${totalCount}</span>
        <span class="stat-lbl">Reports</span>
      </div>
      <div class="stat-item">
        <span class="stat-val" style="color: var(--critical);">${activeCount}</span>
        <span class="stat-lbl">Active</span>
      </div>
      <div class="stat-item">
        <span class="stat-val" style="color: #1f8f5f;">${fixedCount}</span>
        <span class="stat-lbl">Fixed</span>
      </div>
    `;
  }

  function renderMap(reports) {
    if (!leafletMap) return;
    mapMarkers.clearLayers();
    const validReports = reports.filter((report) => {
      const ward = getWard(report.wardId);
      return hasValidWardCenter(ward);
    });
    const clusters = buildWardMapClusters(validReports);

    clusters.forEach((cluster) => {
      const icon = L.divIcon({
        className: "incident-bubble-wrapper",
        html: `
          <div class="incident-bubble incident-bubble-${cluster.severity}" style="width:${cluster.size}px;height:${cluster.size}px;">
            <span>${cluster.count}</span>
          </div>
        `,
        iconSize: [cluster.size, cluster.size],
        iconAnchor: [cluster.size / 2, cluster.size / 2],
      });

      const marker = L.marker([cluster.lat, cluster.lng], { icon });
      marker.on("click", () => openBottomSheet(cluster.primaryReport, getWard(cluster.primaryReport.wardId)));
      marker.addTo(mapMarkers);
    });

    if (clusters.length > 1) {
      const bounds = L.latLngBounds(clusters.map((cluster) => [cluster.lat, cluster.lng]));
      leafletMap.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
    } else if (clusters.length === 1) {
      leafletMap.setView([clusters[0].lat, clusters[0].lng], 14);
    } else {
      leafletMap.setView([12.9716, 77.5946], 11);
    }
  }

  function renderHotspots(reports) {
    const clusters = aggregateHotspots(reports)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);

    hotspotListEl.innerHTML = clusters
      .map(
        (cluster) => `
          <article class="stack-item">
            <h4>${escapeHtml(cluster.label)}</h4>
            <p>${escapeHtml(cluster.summary)}</p>
            <div class="chip-row">
              <span class="chip score">Pressure score ${cluster.score}</span>
              <span class="chip">${cluster.reportCount} reports</span>
              <span class="chip">${escapeHtml(cluster.wardName)}</span>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderConstituencies() {
    const cards = window.BBMP_WARDS
      .map((ward) => buildWardSummary(ward))
      .filter((card) => card.openReports > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 30); /* Show at most top 30 worst wards so grid isn't 225 length */

    constituencyGridEl.innerHTML = cards
      .map(
        (card) => `
          <article class="constituency-card">
            <p class="eyebrow">${escapeHtml(card.assemblyConstituency)}</p>
            <h4>${escapeHtml(card.name)}</h4>
            <p>${escapeHtml(card.mla)} · ${escapeHtml(card.party)}</p>
            <div class="chip-row">
              <span class="chip score">Score ${card.score}</span>
              <span class="chip">${card.openReports} unresolved</span>
              <span class="chip">${card.totalReports} total</span>
            </div>
            <div class="status-bar"><span style="width:${Math.min(card.score * 8, 100)}%"></span></div>
            <p>Most pressure in ${escapeHtml(card.topArea)}.</p>
            <a href="${getTwitterIntentUrl(card)}" target="_blank" rel="noopener noreferrer" class="button button-twitter button-wide">
              Action: Tweet at MLA
            </a>
          </article>
        `
      )
      .join("");
  }

  function getTwitterIntentUrl(card) {
    const handle = card.twitter ? `@${card.twitter}` : card.mla;
    const text = `Hey ${handle}! There are ${card.openReports} unresolved bad roads in ${card.name} adding up to a pressure score of ${card.score}. Please fix them! #BengaluruPotholes`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }

  function renderFeed() {
    const feed = [...state.reports]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 7);

    reportsFeedEl.innerHTML = feed
      .map(
        (report) => `
          <article class="feed-item">
            <h4>${escapeHtml(report.title)}</h4>
            <p>${escapeHtml(report.description)}</p>
            <p class="stack-meta">${escapeHtml(getWard(report.wardId).name)} · ${capitalize(
              report.severity
            )} · ${capitalize(report.status)} · ${escapeHtml(report.createdAt)}</p>
            <p class="stack-meta">${report.photoUrls.length} photo(s) attached · ${escapeHtml(
              report.reporterName || "Anonymous"
            )}</p>
          </article>
        `
      )
      .join("");
  }

  function handlePhotoSelection(event) {
    const files = Array.from(event.target.files || []).slice(0, 3);
    state.pendingPhotos = files;
    photoPreviewEl.innerHTML = files
      .map((file) => {
        const src = URL.createObjectURL(file);
        return `
          <article class="photo-card">
            <img src="${src}" alt="${escapeHtml(file.name)}" />
            <span>${escapeHtml(file.name)}</span>
          </article>
        `;
      })
      .join("");
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      locationMessageEl.textContent = "This browser does not support geolocation.";
      return;
    }

    locationMessageEl.textContent = "Fetching your current location...";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        reportFormEl.elements.lat.value = position.coords.latitude.toFixed(6);
        reportFormEl.elements.lng.value = position.coords.longitude.toFixed(6);
        locationMessageEl.textContent = "Location attached successfully.";
      },
      () => {
        locationMessageEl.textContent = "Location permission was denied or unavailable.";
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    formMessageEl.textContent = "Saving report...";
    const formData = new FormData(reportFormEl);
    const report = {
      id: `local-${Date.now()}`,
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      wardId: String(formData.get("wardId") || ""),
      severity: String(formData.get("severity") || "medium"),
      status: "open",
      lat: Number(formData.get("lat")),
      lng: Number(formData.get("lng")),
      locationText: String(formData.get("title") || "").trim(),
      reporterName: String(formData.get("reporterName") || "").trim() || "Anonymous",
      photoUrls: [],
      createdAt: new Date().toISOString().slice(0, 10),
    };

    if (state.supabase) {
      try {
        report.photoUrls = await uploadPhotos(state.pendingPhotos);
        await insertRemoteReport(report);
        formMessageEl.textContent = "Report submitted to Supabase successfully.";
        state.reports = [report, ...state.reports];
      } catch (error) {
        formMessageEl.textContent = getReadableSubmitError(error);
      }
    } else {
      report.photoUrls = state.pendingPhotos.map((file) => file.name);
      state.reports = [report, ...state.reports];
      persistLocalReports();
      formMessageEl.textContent =
        "Report saved locally. Add Supabase credentials in config.js for live uploads.";
    }

    reportFormEl.reset();
    state.pendingPhotos = [];
    photoPreviewEl.innerHTML = "";
    locationMessageEl.textContent = "";
    render();
  }

  async function uploadPhotos(files) {
    if (!files.length) {
      return [];
    }

    const config = window.BLR_POTHOLE_CONFIG || {};
    const bucket = config.storageBucket || "report-photos";
    const uploaded = [];

    for (const file of files.slice(0, 3)) {
      const path = `public/${Date.now()}-${sanitizeFileName(file.name)}`;
      const { error } = await state.supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        throw error;
      }

      const { data } = state.supabase.storage.from(bucket).getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }

    return uploaded;
  }

  async function insertRemoteReport(report) {
    const payload = {
      title: report.title,
      location_text: report.locationText,
      description: report.description,
      reporter_name: report.reporterName,
      severity: report.severity,
      status: report.status,
      lat: report.lat,
      lng: report.lng,
      ward_id: report.wardId,
      photo_urls: report.photoUrls,
    };

    const { error } = await state.supabase.from("reports").insert(payload);

    if (error) {
      throw error;
    }
  }

  function normalizeRemoteReport(report) {
    return {
      id: report.id,
      title: report.title,
      description: report.description,
      severity: report.severity,
      status: report.status,
      lat: report.lat,
      lng: report.lng,
      wardId: report.ward_id || report.constituency_id || "W1",
      locationText: report.location_text || report.title,
      reporterName: report.reporter_name || "Anonymous",
      photoUrls: report.photo_urls || [],
      createdAt: String(report.created_at || "").slice(0, 10),
    };
  }

  function getFilteredReports() {
    return state.reports.filter((report) => {
      const matchesSeverity =
        state.filters.severity === "all" || report.severity === state.filters.severity;
      const matchesStatus = state.filters.status === "all" || report.status === state.filters.status;
      return matchesSeverity && matchesStatus;
    });
  }

  function buildWardSummary(ward) {
    const wardReports = state.reports.filter((report) => report.wardId === ward.id);
    const unresolvedReports = wardReports.filter((report) => report.status !== "fixed");
    const score = unresolvedReports.reduce((sum, report) => sum + severityWeight[report.severity], 0);

    return {
      ...ward,
      totalReports: wardReports.length,
      openReports: unresolvedReports.length,
      score,
      topArea: wardReports[0] ? wardReports[0].title : "no reports yet",
    };
  }

  function aggregateHotspots(reports) {
    const grouped = new Map();

    for (const report of reports) {
      const ward = getWard(report.wardId);
      const key = `${ward.id}-${report.title.split(" ").slice(0, 3).join(" ")}`;
      const current = grouped.get(key) || {
        label: report.title,
        wardName: ward.name,
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

  function getWard(id) {
    return window.BBMP_WARDS.find((w) => w.id === id) || window.BBMP_WARDS[0];
  }

  function openBottomSheet(report, ward) {
    if (!sheetEl) return;
    
    const isCritical = report.severity === "critical";
    document.getElementById("sheet-tags").innerHTML = `
      ${isCritical ? '<span class="tag-critical">CRITICAL</span>' : ''}
      <span class="tag-status">${capitalize(escapeHtml(report.status))}</span>
    `;
    
    document.getElementById("sheet-title").textContent = report.title;
    document.getElementById("sheet-address").textContent = `Nearby Address: ${report.locationText}`;
    
    const imageContainer = document.getElementById("sheet-image-container");
    if (report.photoUrls && report.photoUrls.length > 0) {
      imageContainer.innerHTML = `<img src="${encodeURI(report.photoUrls[0])}" alt="Damage" />`;
    } else {
      imageContainer.innerHTML = "";
    }
    
    const daysActive = Math.max(1, Math.floor((new Date() - new Date(report.createdAt)) / (1000 * 60 * 60 * 24)));
    
    document.getElementById("sheet-metrics").innerHTML = `
      <div class="sheet-metric">
        <strong>1</strong>
        <span>Reports</span>
      </div>
      <div class="sheet-metric">
        <strong>${daysActive}</strong>
        <span>Days</span>
      </div>
      <div class="sheet-metric">
        <strong>${capitalize(report.severity)}</strong>
        <span>Severity</span>
      </div>
    `;

    const cSummary = buildWardSummary(ward);
    
    document.getElementById("sheet-tree").innerHTML = `
      <div class="tree-node" style="background:#fff2f2; padding:10px 20px; border-radius:99px; border:1px solid #ffcaca; color:#d62828;">
        <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase;">Your Area</span><br>
        <strong style="font-size:1.1rem;">${escapeHtml(ward.name)}</strong>
      </div>
      <div style="width:2px; height:30px; background:rgba(0,0,0,0.1); margin:-24px 0 0;"></div>
      <div class="tree-node" style="margin-top:24px;">
        <div style="width:40px; height:40px; background:#4f46e5; border-radius:12px; margin:0 auto; color:white; display:flex; align-items:center; justify-content:center; font-weight:700;">ZON</div>
        <h4>${escapeHtml(ward.assemblyConstituency)}</h4>
        <p>Assembly constituency</p>
      </div>
      <div style="width:2px; height:20px; background:rgba(0,0,0,0.1); margin:-24px 0 0;"></div>
      <div class="tree-node" style="margin-top:24px;">
        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(ward.mla)}&background=f05a28&color=fff" class="tree-avatar" />
        <h4>${escapeHtml(ward.mla)}</h4>
        <p>${escapeHtml(ward.party)} · MLA Representative</p>
      </div>
    `;

    const mlaAction = document.getElementById("sheet-action-mla");
    mlaAction.href = getTwitterIntentUrl(cSummary);

    sheetEl.classList.add("sheet-open");
  }

  function metricCard(value, label) {
    return `<div class="metric"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  function getSeverityColor(severity) {
    return { critical: "#d62828", high: "#f77f00", medium: "#fcbf49", low: "#5fa8d3" }[severity];
  }

  function hasValidMapPoint(report) {
    return (
      typeof report.lat === "number" &&
      typeof report.lng === "number" &&
      !isNaN(report.lat) &&
      !isNaN(report.lng) &&
      report.lat >= bounds.minLat &&
      report.lat <= bounds.maxLat &&
      report.lng >= bounds.minLng &&
      report.lng <= bounds.maxLng
    );
  }

  function hasValidWardCenter(ward) {
    return (
      ward &&
      typeof ward.centerLat === "number" &&
      typeof ward.centerLng === "number" &&
      ward.centerLat >= bounds.minLat &&
      ward.centerLat <= bounds.maxLat &&
      ward.centerLng >= bounds.minLng &&
      ward.centerLng <= bounds.maxLng
    );
  }

  function buildWardMapClusters(reports) {
    const grouped = new Map();

    reports.forEach((report) => {
      const ward = getWard(report.wardId);
      if (!hasValidWardCenter(ward)) {
        return;
      }

      const current = grouped.get(ward.id) || {
        ward,
        reports: [],
      };
      current.reports.push(report);
      grouped.set(ward.id, current);
    });

    return [...grouped.values()].map(({ ward, reports }) => {
      const sortedReports = [...reports].sort(
        (left, right) => severityWeight[right.severity] - severityWeight[left.severity]
      );
      const score = reports.reduce((sum, report) => sum + severityWeight[report.severity], 0);
      return {
        lat: ward.centerLat,
        lng: ward.centerLng,
        count: reports.length,
        severity: sortedReports[0].severity,
        size: Math.min(88, 28 + score * 7),
        primaryReport: sortedReports[0],
      };
    });
  }



  function capitalize(value) {
    return value
      .split("-")
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  }

  function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getReadableSubmitError(error) {
    const raw = String(error && error.message ? error.message : error || "unknown error");

    if (raw.includes("ward_id")) {
      return "Live submit failed: your Supabase reports table is missing the ward_id column. Run the updated schema SQL and try again.";
    }

    return `Live submit failed: ${raw}`;
  }
})();
