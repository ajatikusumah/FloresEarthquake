"use strict";

(() => {
  const BMKG_URL = "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json";
  const IMPACT_URL = "data/impact.json";
  const REFRESH_MS = 5 * 60 * 1000;

  const byId = (id) => document.getElementById(id);

  const setText = (id, value) => {
    const element = byId(id);
    if (element && value !== undefined && value !== null) {
      element.textContent = value;
    }
  };

  const isFloresRegion = (quake) => {
    const coordinates = String(quake.Coordinates || "")
      .split(",")
      .map(Number);
    const [latitude, longitude] = coordinates;
    const insideRegionalBounds =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -11.5 &&
      latitude <= -6 &&
      longitude >= 118 &&
      longitude <= 125;

    const place = String(quake.Wilayah || "").toUpperCase();
    const hasRegionalName =
      /NTT|NAGEKEO|MBAY|RUTENG|MANGGARAI|LABUANBAJO|SIKKA|MAUMERE|ENDE|FLORES/.test(
        place
      );

    return insideRegionalBounds || hasRegionalName;
  };

  const formatRefreshTime = () =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date());

  const createRecentQuake = (quake) => {
    const row = document.createElement("div");
    row.className = "live-quake-row";

    const magnitude = document.createElement("strong");
    magnitude.textContent = `M${quake.Magnitude || "—"}`;

    const location = document.createElement("span");
    location.textContent = quake.Wilayah || "Location unavailable";

    const time = document.createElement("time");
    time.dateTime = quake.DateTime || "";
    time.textContent = `${quake.Tanggal || "—"} · ${quake.Jam || "—"}`;

    row.append(magnitude, location, time);
    return row;
  };

  const renderBmkgFeed = (quakes) => {
    const regionalQuakes = quakes.filter(isFloresRegion);
    const latest = regionalQuakes[0];

    if (!latest) {
      throw new Error("No recent Flores/NTT M5+ event found in the current BMKG list.");
    }

    setText("live-magnitude", `M${latest.Magnitude}`);
    setText("live-depth", latest.Kedalaman);
    setText("live-location", latest.Wilayah);
    setText("live-event-time", `${latest.Tanggal} · ${latest.Jam}`);
    setText("live-potential", latest.Potensi);
    setText("live-coordinates", latest.Coordinates);
    setText("feed-last-checked", `Last checked: ${formatRefreshTime()} WIB`);

    const status = byId("feed-status");
    if (status) {
      status.textContent = "BMKG feed connected";
      status.className = "feed-status is-live";
    }

    const recentList = byId("recent-quakes");
    if (recentList) {
      recentList.replaceChildren(
        ...regionalQuakes.slice(0, 5).map(createRecentQuake)
      );
    }
  };

  const loadBmkgFeed = async () => {
    try {
      const response = await fetch(`${BMKG_URL}?t=${Date.now()}`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`BMKG request failed: ${response.status}`);

      const payload = await response.json();
      const quakes = payload?.Infogempa?.gempa;
      if (!Array.isArray(quakes)) throw new Error("Unexpected BMKG data format.");

      renderBmkgFeed(quakes);
    } catch (error) {
      console.error(error);
      const status = byId("feed-status");
      if (status) {
        status.textContent = "Live feed temporarily unavailable — fallback values shown";
        status.className = "feed-status is-warning";
      }
      setText("feed-last-checked", `Last attempt: ${formatRefreshTime()} WIB`);
    }
  };

  const renderList = (id, items) => {
    const list = byId(id);
    if (!list || !Array.isArray(items)) return;
    list.replaceChildren(
      ...items.map((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        return li;
      })
    );
  };

  const loadImpactData = async () => {
    try {
      const response = await fetch(`${IMPACT_URL}?t=${Date.now()}`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Impact data request failed: ${response.status}`);

      const data = await response.json();
      setText(
        "impact-casualties",
        `${data.casualties?.deaths ?? "—"} | ${data.casualties?.injured ?? "—"}`
      );
      setText("impact-cutoff", `Impact update: ${data.updated_display}`);
      setText("impact-validation-status", data.status_label);
      setText(
        "impact-displacement",
        Number(data.displacement?.self_evacuated_approx || 0).toLocaleString("en-US")
      );

      renderList("impact-confirmed-list", data.confirmed);
      renderList("impact-damage-list", data.damage_reports);
      renderList("impact-gaps-list", data.information_gaps);

      const sourceLink = byId("impact-source-link");
      if (sourceLink && data.source?.url) {
        sourceLink.href = data.source.url;
        sourceLink.textContent = data.source.agency || "Official source";
      }
    } catch (error) {
      console.error(error);
      setText("impact-validation-status", "Static fallback data shown");
    }
  };

  loadImpactData();
  loadBmkgFeed();
  window.setInterval(loadBmkgFeed, REFRESH_MS);
})();
