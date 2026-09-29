/* map page: treemap, call graph, data and code. Plain script, no build step; d3 and dagre are inlined globals. */
(function () {
  "use strict";

  function load(name) {
    var el = document.getElementById("data-" + name);
    try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; }
  }
  var DATA = {
    treemap: load("treemap"), callgraph: load("callgraph"), erd: load("erd"),
    diagnostics: load("diagnostics") || [], meta: load("meta") || {}
  };
  window.__MAP_DATA__ = DATA;

  var tooltip = document.getElementById("tooltip");
  var filterBox = document.getElementById("filter");

  // ---------------------------------------------------------------- helpers
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n, digits) {
    if (n == null || isNaN(n)) return "–";
    if (digits != null) return Number(n).toFixed(digits);
    return Number(n).toLocaleString();
  }
  function money(n) { return n == null ? "–" : "$" + Number(n).toFixed(n >= 1 ? 2 : 4); }
  function when(ms) { return ms == null ? "–" : new Date(ms).toISOString().replace("T", " ").slice(0, 16); }
  function shortId(id) { return id ? String(id).slice(0, 8) : "–"; }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function ramp() { return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return cssVar("--seq-" + i); }); }
  function showTip(ev, html) {
    tooltip.innerHTML = html;
    tooltip.style.display = "block";
    var x = ev.clientX + 14, y = ev.clientY + 14;
    var r = tooltip.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - 14;
    tooltip.style.left = Math.max(8, x) + "px";
    tooltip.style.top = Math.max(8, y) + "px";
  }
  function inkOn(fill) {
    var c = d3.color(fill);
    if (!c) return null;
    var rgb = c.rgb();
    var lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return lum > 0.55 ? "#0b0b0b" : "#ffffff";
  }
  function hideTip() { tooltip.style.display = "none"; }
  function sizeOf(el) { var r = el.getBoundingClientRect(); return { w: Math.max(200, r.width), h: Math.max(200, r.height) }; }
  function textWidth(s, px) { return String(s).length * (px || 11) * 0.6; }
  function zoomable(svg, g) {
    svg.call(d3.zoom().scaleExtent([0.1, 4]).on("zoom", function (e) { g.attr("transform", e.transform); }));
  }
  function fitTransform(svg, g, box) {
    var bb = g.node().getBBox();
    if (!bb.width || !bb.height) return;
    var k = Math.min(1.2, 0.95 * Math.min(box.w / bb.width, box.h / bb.height));
    var tx = (box.w - bb.width * k) / 2 - bb.x * k, ty = (box.h - bb.height * k) / 2 - bb.y * k;
    svg.call(d3.zoom().scaleExtent([0.1, 4]).on("zoom", function (e) { g.attr("transform", e.transform); }).transform,
      d3.zoomIdentity.translate(tx, ty).scale(k));
  }

  // ----------------------------------------------------------------- header
  var meta = DATA.meta, tm = DATA.treemap || {};
  document.getElementById("repo-name").textContent = meta.repo_name || tm.repo_name || "project";
  document.getElementById("built").textContent = meta.generated_at ? meta.generated_at.replace("T", " ").replace("+00:00", " UTC") : "–";
  document.getElementById("hl-turn").textContent = shortId(meta.highlight_turn);
  document.getElementById("hl-turn").title = meta.highlight_turn || "";
  document.getElementById("window").textContent = (meta.window_days || tm.window_days || "?") + " days";
  var diagButton = document.getElementById("diag-open");
  var counts = meta.diagnostics || { warning: 0, error: 0 };
  diagButton.textContent = DATA.diagnostics.length + " diagnostics (" + counts.error + " errors)";
  diagButton.addEventListener("click", function () {
    var rows = DATA.diagnostics.map(function (d) {
      return "<tr><td class='sev-" + esc(d.severity) + "'>" + esc(d.severity) + "</td><td class='mono'>" + esc(d.extractor) +
        "</td><td class='mono'>" + esc(d.path || "") + "</td><td>" + esc(d.message) + "</td></tr>";
    }).join("");
    document.getElementById("diag-body").innerHTML = rows
      ? "<table><thead><tr><th>severity</th><th>extractor</th><th>path</th><th>message</th></tr></thead><tbody>" + rows + "</tbody></table>"
      : "<p>No diagnostics.</p>";
    document.getElementById("diag-dialog").showModal();
  });
  document.getElementById("diag-close").addEventListener("click", function () { document.getElementById("diag-dialog").close(); });

  // ------------------------------------------------------------------- tabs
  var TABS = ["treemap", "callgraph", "data", "code"];
  var rendered = {};
  var current = "treemap";
  function selectTab(name) {
    current = name;
    TABS.forEach(function (t) {
      document.getElementById("tab-" + t).setAttribute("aria-selected", String(t === name));
      document.getElementById("view-" + t).classList.toggle("active", t === name);
    });
    render(name);
  }
  function render(name) {
    hideTip();
    if (name === "treemap") Treemap.render();
    else if (name === "callgraph") CallGraph.render();
    else ErdView.render(name);
    rendered[name] = true;
  }
  TABS.forEach(function (t) {
    document.getElementById("tab-" + t).addEventListener("click", function () { selectTab(t); });
  });
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName || "");
    if (e.key === "/" && !typing) { e.preventDefault(); filterBox.focus(); filterBox.select(); return; }
    if (e.key === "Escape" && e.target === filterBox) { filterBox.blur(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    var i = ["1", "2", "3", "4"].indexOf(e.key);
    if (i >= 0) selectTab(TABS[i]);
  });
  var filterTimer = null;
  filterBox.addEventListener("input", function () {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(function () { render(current); }, 150);
  });
  window.addEventListener("resize", function () { clearTimeout(filterTimer); filterTimer = setTimeout(function () { render(current); }, 200); });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", function () { render(current); });
  }
  function filterText() { return filterBox.value.trim().toLowerCase(); }

  // --------------------------------------------------------------- treemap
  var Treemap = (function () {
    var MODES = [
      { key: "ccn_max", label: "complexity", legend: "max cyclomatic complexity per file", get: function (d) { return d.metrics.ccn_max; } },
      { key: "edits", label: "edits", legend: "successful agent edits", get: function (d) { return d.agent.edits; } },
      { key: "reads", label: "reads", legend: "successful agent reads", get: function (d) { return d.agent.reads; } },
      { key: "cost", label: "cost", legend: "USD from turns that edited the file", get: function (d) { return d.agent.cost_usd; } },
      { key: "commits", label: "git commits", legend: "commits touching the file", get: function (d) { return d.git.commits; } }
    ];
    var mode = MODES[0];
    var selected = null;
    var drilled = null;
    var modeBox = document.getElementById("tm-modes");
    MODES.forEach(function (m) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = m.label;
      b.setAttribute("aria-pressed", String(m === mode));
      b.addEventListener("click", function () {
        mode = m;
        Array.prototype.forEach.call(modeBox.children, function (c) { c.setAttribute("aria-pressed", String(c === b)); });
        render();
      });
      modeBox.appendChild(b);
    });
    document.getElementById("tm-labels").addEventListener("change", function () { render(); });

    function files(root) {
      var out = [];
      (function walk(n) { if (n.type === "file") out.push(n); else (n.children || []).forEach(walk); })(root);
      return out;
    }

    function render() {
      var canvas = document.getElementById("tm-canvas");
      canvas.innerHTML = "";
      if (!tm.root) { canvas.innerHTML = "<p class='note'>No treemap data.</p>"; return; }
      var box = sizeOf(canvas);
      var q = filterText();
      var all = files(tm.root);
      var max = d3.max(all, function (d) { return +mode.get(d) || 0; }) || 0;
      var colors = ramp();
      var scale = d3.scaleSequentialSqrt(d3.interpolateRgbBasis(colors)).domain([0, max || 1]);
      var zero = cssVar("--zero");
      function fill(d) { var v = +mode.get(d) || 0; return v > 0 ? scale(v) : zero; }
      var window_ = tm.window_days || meta.window_days;
      var legend = document.getElementById("tm-legend");
      var gradient = colors.map(function (c, i) { return c + " " + Math.round(100 * i / (colors.length - 1)) + "%"; }).join(",");
      legend.innerHTML = "<span>0</span><span class='bar' style='background:linear-gradient(90deg," + gradient + ")'></span><span>" +
        esc(mode.key === "cost" ? money(max) : fmt(max)) + "</span><span>" + esc(mode.legend) +
        (mode.key === "ccn_max" ? "" : ", last " + esc(window_) + " days") + "</span>";

      var hierarchy = d3.hierarchy(tm.root, function (d) { return d.type === "dir" ? d.children : null; })
        .sum(function (d) { return d.type === "file" ? Math.max(1, d.size || 0) : 0; });
      d3.treemap().tile(d3.treemapSquarify).size([box.w, box.h]).paddingInner(1).paddingOuter(2)
        .paddingTop(function (d) { return d.depth > 0 && d.y1 - d.y0 > 40 ? 14 : 2; }).round(true)(hierarchy);

      var svg = d3.select(canvas).append("svg").attr("viewBox", "0 0 " + box.w + " " + box.h)
        .attr("role", "img").attr("aria-label", "Treemap of files sized by lines of code, colored by " + mode.label);
      var dirs = hierarchy.descendants().filter(function (d) { return d.data.type === "dir" && d.depth > 0; });
      svg.append("g").selectAll("rect").data(dirs).join("rect").attr("class", "tm-dir")
        .attr("x", function (d) { return d.x0; }).attr("y", function (d) { return d.y0; })
        .attr("width", function (d) { return Math.max(0, d.x1 - d.x0); }).attr("height", function (d) { return Math.max(0, d.y1 - d.y0); });
      svg.append("g").selectAll("text").data(dirs.filter(function (d) { return d.y1 - d.y0 > 40 && d.x1 - d.x0 > 50; })).join("text")
        .attr("class", "tm-dir-label").attr("x", function (d) { return d.x0 + 4; }).attr("y", function (d) { return d.y0 + 11; })
        .text(function (d) { var w = d.x1 - d.x0 - 8; var s = d.data.name + "/"; return textWidth(s) > w ? s.slice(0, Math.max(1, Math.floor(w / 6.6))) + "…" : s; });

      var leaves = hierarchy.leaves().filter(function (d) { return d.data.type === "file"; });
      var g = svg.append("g");
      var cells = g.selectAll("g").data(leaves).join("g");
      cells.append("rect")
        .attr("class", function (d) { return "tm-file" + (d.data.highlight ? " hl" : "") + (selected === d.data.path ? " sel" : ""); })
        .attr("x", function (d) { return d.x0; }).attr("y", function (d) { return d.y0; })
        .attr("width", function (d) { return Math.max(0, d.x1 - d.x0); }).attr("height", function (d) { return Math.max(0, d.y1 - d.y0); })
        .attr("fill", function (d) { return fill(d.data); })
        .attr("opacity", function (d) { return q && d.data.path.toLowerCase().indexOf(q) < 0 ? 0.18 : 1; })
        .attr("tabindex", 0)
        .attr("aria-label", function (d) { return d.data.path + ", " + mode.label + " " + mode.get(d.data); })
        .on("mousemove", function (e, d) {
          var v = mode.get(d.data);
          showTip(e, "<div class='t'>" + esc(d.data.path) + "</div><div class='s'>" + esc(mode.label) + ": <b>" +
            esc(mode.key === "cost" ? money(v) : fmt(v)) + "</b> · nloc " + fmt(d.data.metrics.nloc) +
            (d.data.highlight ? " · edited in highlighted turn" : "") + "</div>");
        })
        .on("mouseleave", hideTip)
        .on("click", function (e, d) { selected = d.data.path; drilled = null; panel(d.data); render(); })
        .on("keydown", function (e, d) { if (e.key === "Enter") { selected = d.data.path; panel(d.data); render(); } });

      if (document.getElementById("tm-labels").checked) {
        cells.filter(function (d) { return d.x1 - d.x0 > 46 && d.y1 - d.y0 > 16; }).append("text").attr("class", "tm-file-label")
          .attr("x", function (d) { return d.x0 + 3; }).attr("y", function (d) { return d.y0 + 12; })
          .style("fill", function (d) { return inkOn(fill(d.data)); })
          .text(function (d) { var w = d.x1 - d.x0 - 6; var s = d.data.name; return textWidth(s, 10) > w ? s.slice(0, Math.max(1, Math.floor(w / 6))) + "…" : s; });
      }

      if (drilled) {
        var leaf = leaves.find(function (d) { return d.data.path === drilled; });
        if (leaf && leaf.data.children && leaf.data.children.length) {
          var sub = d3.hierarchy({ children: leaf.data.children }).sum(function (d) { return d.children ? 0 : Math.max(1, d.nloc || 0); });
          d3.treemap().tile(d3.treemapSquarify).size([leaf.x1 - leaf.x0, leaf.y1 - leaf.y0]).paddingInner(1).round(true)(sub);
          var maxCcn = d3.max(leaf.data.children, function (f) { return f.ccn; }) || 1;
          var fscale = d3.scaleSequentialSqrt(d3.interpolateRgbBasis(colors)).domain([0, maxCcn]);
          var fg = svg.append("g").attr("transform", "translate(" + leaf.x0 + "," + leaf.y0 + ")");
          fg.selectAll("rect").data(sub.leaves()).join("rect").attr("class", "tm-fn")
            .attr("x", function (d) { return d.x0; }).attr("y", function (d) { return d.y0; })
            .attr("width", function (d) { return Math.max(0, d.x1 - d.x0); }).attr("height", function (d) { return Math.max(0, d.y1 - d.y0); })
            .attr("fill", function (d) { return fscale(d.data.ccn); })
            .on("mousemove", function (e, d) {
              showTip(e, "<div class='t'>" + esc(d.data.name) + "</div><div class='s'>ccn <b>" + d.data.ccn + "</b> · nloc " + d.data.nloc +
                " · lines " + d.data.start_line + "–" + d.data.end_line + "</div>");
            }).on("mouseleave", hideTip);
          fg.append("rect").attr("width", leaf.x1 - leaf.x0).attr("height", leaf.y1 - leaf.y0).attr("fill", "none")
            .attr("stroke", cssVar("--accent")).attr("stroke-width", 2.5);
        }
      }
    }

    function panel(d) {
      var p = document.getElementById("tm-panel");
      var a = d.agent, m = d.metrics, git = d.git;
      var fns = (d.children || []).slice().sort(function (x, y) { return y.ccn - x.ccn || y.nloc - x.nloc; });
      var acc = accessesFrom(d.path);
      var html = "<h2 class='mono'>" + esc(d.path) + "</h2>" +
        (d.highlight ? "<p><b>Edited in the highlighted turn.</b></p>" : "") +
        "<table><tbody>" +
        "<tr><th>nloc</th><td class='num'>" + fmt(m.nloc) + "</td><th>functions</th><td class='num'>" + fmt(m.functions) + "</td></tr>" +
        "<tr><th>ccn max</th><td class='num'>" + fmt(m.ccn_max) + "</td><th>ccn sum</th><td class='num'>" + fmt(m.ccn_sum) + "</td></tr>" +
        "<tr><th>edits</th><td class='num'>" + fmt(a.edits) + "</td><th>reads</th><td class='num'>" + fmt(a.reads) + "</td></tr>" +
        "<tr><th>blocked</th><td class='num'>" + fmt(a.blocked) + "</td><th>deduped</th><td class='num'>" + fmt(a.deduped) + "</td></tr>" +
        "<tr><th>cost</th><td class='num'>" + money(a.cost_usd) + "</td><th>last touch</th><td class='num'>" + esc(when(a.last_touched_ts)) + "</td></tr>" +
        "<tr><th>commits</th><td class='num'>" + fmt(git.commits) + "</td><th>lines changed</th><td class='num'>" + fmt(git.lines_changed) + "</td></tr>" +
        "</tbody></table>";
      html += "<h3>Functions (" + fns.length + ")</h3>";
      if (fns.length) {
        html += "<p><button type='button' id='tm-drill'>" + (drilled === d.path ? "Hide function tiles" : "Show function tiles") + "</button></p>";
        html += "<table><thead><tr><th>name</th><th class='num'>ccn</th><th class='num'>nloc</th><th class='num'>line</th></tr></thead><tbody>" +
          fns.slice(0, 60).map(function (f) {
            return "<tr><td class='mono'>" + esc(f.name) + "</td><td class='num'>" + f.ccn + "</td><td class='num'>" + f.nloc + "</td><td class='num'>" + f.start_line + "</td></tr>";
          }).join("") + "</tbody></table>" + (fns.length > 60 ? "<p class='empty'>" + (fns.length - 60) + " more</p>" : "");
      } else html += "<p class='empty'>None measured.</p>";
      html += "<h3>Recent turns</h3>";
      html += a.turns.length ? "<table><tbody>" + a.turns.map(function (t) {
        var turn = turnById(t);
        return "<tr><td class='mono'><button class='linkish' type='button' data-turn='" + esc(t) + "'>" + esc(shortId(t)) + "</button></td><td>" +
          esc(turn ? when(turn.start_ms) : "") + "</td><td class='num'>" + (turn ? money(turn.cost_usd) : "") + "</td></tr>";
      }).join("") + "</tbody></table>" : "<p class='empty'>No agent turns touched this file in the window.</p>";
      html += "<h3>Explain</h3>" + (d.explain.length ? "<ul>" + d.explain.map(function (x) {
        return "<li><a class='mono' href='" + esc(relativeLink(x)) + "'>" + esc(x) + "</a></li>";
      }).join("") + "</ul>" : "<p class='empty'>No walkthrough linked to these turns.</p>");
      html += "<h3>Entities defined here</h3>" + (d.entities.length ? "<ul>" + d.entities.map(function (e) {
        return "<li class='mono'>" + esc(e.split("::")[1] || e) + "</li>";
      }).join("") + "</ul>" : "<p class='empty'>None.</p>");
      html += "<h3>Accesses from here</h3>" + (acc.length ? "<table><tbody>" + acc.map(function (x) {
        return "<tr><td>" + esc(x.mode) + "</td><td class='mono'>" + esc(x.target) + "</td><td class='num'>" + x.count + "</td></tr>";
      }).join("") + "</tbody></table>" : "<p class='empty'>None resolved.</p>");
      p.innerHTML = html;
      var drill = document.getElementById("tm-drill");
      if (drill) drill.addEventListener("click", function () { drilled = drilled === d.path ? null : d.path; panel(d); render(); });
      Array.prototype.forEach.call(p.querySelectorAll("button[data-turn]"), function (b) {
        b.addEventListener("click", function () { CallGraph.showTurn(b.getAttribute("data-turn")); selectTab("callgraph"); });
      });
    }

    function relativeLink(path) {
      var out = (meta.out_rel_to_repo || ".agent/map").split("/").filter(Boolean).map(function () { return ".."; }).join("/");
      return (out ? out + "/" : "") + path;
    }
    return { render: render };
  })();

  function accessesFrom(path) {
    var erd = DATA.erd || { accesses: [] };
    return erd.accesses.filter(function (a) { return a.actor_file === path; });
  }
  function turnById(id) {
    var cg = DATA.callgraph || { turns: [] };
    return cg.turns.find(function (t) { return t.turn_id === id; }) || null;
  }

  // ------------------------------------------------------------ call graph
  var CallGraph = (function () {
    var cg = DATA.callgraph || { aggregate: { nodes: [], edges: [] }, turns: [], totals: {} };
    var select = document.getElementById("cg-turn");
    var turnId = "";
    select.innerHTML = "<option value=''>Aggregate (" + cg.turns.length + " recent turns)</option>" + cg.turns.map(function (t) {
      return "<option value='" + esc(t.turn_id) + "'>" + esc(when(t.start_ms)) + " · " + esc(shortId(t.turn_id)) + " · " + money(t.cost_usd) +
        (t.turn_id === meta.highlight_turn ? " · highlighted" : "") + "</option>";
    }).join("");
    select.addEventListener("change", function () { turnId = select.value; render(); });
    var T = cg.totals || {};
    document.getElementById("cg-totals").innerHTML = "turns <b>" + fmt(T.turns) + "</b> · cost <b>" + money(T.cost_usd) +
      "</b> · cache hit <b>" + (T.cache_hit_rate == null ? "–" : fmt(100 * T.cache_hit_rate, 1) + "%") + "</b> · blocked <b>" + fmt(T.blocked) +
      "</b> · deduped <b>" + fmt(T.deduped) + "</b>";

    function showTurn(id) { turnId = id; select.value = id; }

    function render() {
      var canvas = document.getElementById("cg-canvas");
      canvas.innerHTML = "";
      canvas.classList.toggle("scroll", !!turnId);
      if (turnId) return timeline(canvas, cg.turns.find(function (t) { return t.turn_id === turnId; }));
      var nodes = cg.aggregate.nodes, edges = cg.aggregate.edges;
      if (!nodes.length) { canvas.innerHTML = "<p class='note'>No telemetry attributed to this project in the window.</p>"; return; }
      var q = filterText();
      var g = new dagre.graphlib.Graph();
      g.setGraph({ rankdir: "LR", nodesep: 14, ranksep: 70, marginx: 20, marginy: 20 });
      g.setDefaultEdgeLabel(function () { return {}; });
      var maxCount = d3.max(nodes, function (n) { return n.count; }) || 1;
      var hScale = d3.scaleSqrt().domain([1, maxCount]).range([26, 64]);
      nodes.forEach(function (n) {
        var label = nodeLabel(n);
        g.setNode(n.id, { width: Math.max(90, textWidth(label, 11) + 20), height: hScale(n.count), data: n, label: label });
      });
      edges.forEach(function (e) { if (g.hasNode(e.src) && g.hasNode(e.dst)) g.setEdge(e.src, e.dst, { data: e, width: 30, height: 12, labelpos: "c" }); });
      dagre.layout(g);
      var box = sizeOf(canvas);
      var svg = d3.select(canvas).append("svg").attr("role", "img").attr("aria-label", "Aggregate call graph");
      var root = svg.append("g");
      var maxEdge = d3.max(edges, function (e) { return e.count; }) || 1;
      var wScale = d3.scaleSqrt().domain([1, maxEdge]).range([1, 7]);
      var line = d3.line().x(function (p) { return p.x; }).y(function (p) { return p.y; }).curve(d3.curveBasis);
      g.edges().forEach(function (e) {
        var ed = g.edge(e);
        root.append("path").attr("class", "cg-edge").attr("d", line(ed.points)).attr("stroke-width", wScale(ed.data.count));
        root.append("text").attr("class", "cg-edge-label").attr("x", ed.x).attr("y", ed.y + 3).attr("text-anchor", "middle").text("×" + ed.data.count);
      });
      var maxCost = d3.max(nodes, function (n) { return n.cost_usd; }) || 0;
      var colors = ramp();
      var costScale = d3.scaleSequentialSqrt(d3.interpolateRgbBasis(colors)).domain([0, maxCost || 1]);
      g.nodes().forEach(function (id) {
        var nd = g.node(id), n = nd.data;
        var dim = q && (n.name + " " + n.kind).toLowerCase().indexOf(q) < 0;
        var grp = root.append("g").attr("class", "cg-node " + n.kind).attr("transform", "translate(" + (nd.x - nd.width / 2) + "," + (nd.y - nd.height / 2) + ")")
          .attr("opacity", dim ? 0.25 : 1).style("cursor", "pointer");
        var hot = n.cost_usd > 0 && maxCost > 0;
        grp.append("rect").attr("width", nd.width).attr("height", nd.height).attr("rx", 6)
          .attr("fill", hot ? costScale(n.cost_usd) : cssVar("--surface-2"));
        grp.append("text").attr("x", 10).attr("y", nd.height / 2 + 4).style("fill", hot ? inkOn(costScale(n.cost_usd)) : null).text(nd.label);
        grp.on("mousemove", function (e) { showTip(e, nodeTip(n)); }).on("mouseleave", hideTip)
          .on("click", function () { nodePanel(n); });
      });
      zoomable(svg, root);
      fitTransform(svg, root, box);
    }

    function nodeLabel(n) {
      if (n.kind === "guard") {
        var o = n.outcomes || {};
        return n.name + " · blocked " + (o.blocked || 0) + " · deduped " + (o.deduped || 0);
      }
      return (n.kind === n.name ? n.kind : n.kind + " " + n.name) + " ×" + n.count;
    }
    function nodeTip(n) {
      var t = n.tokens || {};
      return "<div class='t'>" + esc(n.kind + " · " + n.name) + "</div><div class='s'>count <b>" + fmt(n.count) + "</b> · p50 " +
        fmt(n.dur_ms_p50, 0) + " ms · cost " + money(n.cost_usd) + (n.kind === "model" ? " · prompt " + fmt(t.prompt) + " · cached " + fmt(t.cached) : "") +
        (n.outcomes ? " · " + Object.keys(n.outcomes).map(function (k) { return k + " " + n.outcomes[k]; }).join(", ") : "") + "</div>";
    }
    function nodePanel(n) {
      var t = n.tokens || {};
      var rows = [["kind", n.kind], ["name", n.name], ["count", fmt(n.count)], ["duration sum", fmt(n.dur_ms_sum, 0) + " ms"],
        ["duration p50", fmt(n.dur_ms_p50, 0) + " ms"], ["cost", money(n.cost_usd)]];
      if (n.kind === "model") rows.push(["prompt tokens", fmt(t.prompt)], ["cached tokens", fmt(t.cached)], ["completion tokens", fmt(t.completion)], ["reasoning tokens", fmt(t.reasoning)]);
      Object.keys(n.outcomes || {}).forEach(function (k) { rows.push(["outcome " + k, fmt(n.outcomes[k])]); });
      document.getElementById("cg-panel").innerHTML = "<h2>" + esc(n.kind + " · " + n.name) + "</h2><table><tbody>" +
        rows.map(function (r) { return "<tr><th>" + esc(r[0]) + "</th><td class='num'>" + esc(r[1]) + "</td></tr>"; }).join("") + "</tbody></table>";
    }

    function evBlock(e) {
      var a = e.attrs || {};
      var detail = "";
      if (e.kind === "model") detail = "prompt " + fmt(a.prompt_tokens) + " · cached " + fmt(a.cached_tokens) + " · " + money(a.cost_usd);
      else if (e.kind === "tool") detail = (a.path ? a.path + " · " : "") + (a.outcome || "") + (a.blocked_by ? " by " + a.blocked_by : "");
      else if (e.kind === "guard") detail = a.outcome + (a.tool_name ? " " + a.tool_name : "");
      if (e.dur_ms != null) detail += (detail ? " · " : "") + fmt(e.dur_ms, 0) + " ms";
      return "<div class='ev " + esc(e.kind) + "'><div class='k'>" + esc(e.kind) + "</div><div class='n'>" + esc(e.name) + "</div><div class='d'>" + esc(detail) + "</div></div>";
    }
    function columns(events, turnSpan) {
      var loops = [], byLoop = {};
      events.forEach(function (e) {
        if (e.kind === "loop" && e.parent === turnSpan) { loops.push(e); byLoop[e.span] = []; }
      });
      events.forEach(function (e) {
        if (e.kind === "model" || e.kind === "tool") { if (byLoop[e.parent]) byLoop[e.parent].push(e); }
      });
      var guards = {};
      events.forEach(function (e) { if (e.kind === "guard") (guards[e.parent] = guards[e.parent] || []).push(e); });
      return "<div class='timeline'>" + loops.map(function (l) {
        return "<div class='loop'><h4>loop " + esc(l.attrs.loop_index) + "</h4>" + byLoop[l.span].map(function (e) {
          return evBlock(e) + (guards[e.span] || []).map(evBlock).join("");
        }).join("") + "</div>";
      }).join("") + "</div>";
    }
    function timeline(canvas, turn) {
      if (!turn) { canvas.innerHTML = "<p class='note'>Turn not in the last 50.</p>"; return; }
      var events = turn.events;
      var turnSpan = events[0].span;
      var subs = events.filter(function (e) { return e.kind === "subagent" && e.parent === turnSpan; });
      var html = "<div style='padding:12px 12px 0'><b class='mono'>" + esc(turn.turn_id) + "</b> · " + esc(when(turn.start_ms)) + " · " +
        money(turn.cost_usd) + " incl. subagents" + (turn.edited.length ? " · edited " + esc(turn.edited.join(", ")) : "") + "</div>";
      html += "<div class='timeline'><div>" + columns(events, turnSpan) + "</div>";
      subs.forEach(function (s) {
        var childTurn = events.find(function (e) { return e.kind === "turn" && e.parent === s.span; });
        html += "<div class='sub'><h4>subagent · " + esc(s.name) + (childTurn ? " · " + esc(shortId(childTurn.attrs.turn_id)) : "") + "</h4>" +
          (childTurn ? columns(events, childTurn.span) : "") + "</div>";
      });
      html += "</div>";
      canvas.innerHTML = html;
      document.getElementById("cg-panel").innerHTML = "<h2>Turn " + esc(shortId(turn.turn_id)) + "</h2><table><tbody>" +
        "<tr><th>session</th><td class='mono'>" + esc(shortId(turn.session_id)) + "</td></tr>" +
        "<tr><th>started</th><td>" + esc(when(turn.start_ms)) + "</td></tr>" +
        "<tr><th>duration</th><td>" + fmt(turn.dur_ms, 0) + " ms</td></tr>" +
        "<tr><th>cost</th><td>" + money(turn.cost_usd) + "</td></tr>" +
        "<tr><th>events</th><td>" + fmt(events.length) + "</td></tr></tbody></table>";
    }
    return { render: render, showTurn: showTurn };
  })();

  // ------------------------------------------------------------- data / code
  var ErdView = (function () {
    var erd = DATA.erd || { entities: [], relations: [], accesses: [] };
    var byId = {};
    erd.entities.forEach(function (e) { byId[e.id] = e; });
    ["code-tests", "code-modules", "data-tests"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", function () { render(id === "data-tests" ? "data" : "code"); });
    });
    function codeEntity(e) { return e.layer === "code" && e.kind !== "event"; }
    function codeMember(e) { return e && (e.kind === "function" || e.kind === "method"); }
    function allowed(e, view) { return e && (!e.test || document.getElementById(view + "-tests").checked); }
    function moduleId(id) { return id.split("::")[0]; }
    function subscriptionIds(id) {
      // Subscriptions attach to the named actor, never to an event node in the data view.
      return erd.accesses.filter(function (a) { return a.mode === "subscribe" && a.functions.some(function (f) { return f.actor === id; }); })
        .map(function (a) { return a.target; });
    }
    function graph(view) {
      var list = [], rels = [], match = {}, ids = {}, q = filterText();
      var showModules = view === "code" && document.getElementById("code-modules").checked;
      if (view === "data") {
        list = erd.entities.filter(function (e) { return e.layer === "data" && e.kind !== "module" && allowed(e, view); });
        list.forEach(function (e) { ids[e.id] = true; });
        rels = erd.relations.filter(function (r) {
          return ids[r.src] && ids[r.dst] && (r.kind === "has_field_of" || r.kind === "fk");
        });
        // Accesses are aggregated by file, but functions retain each named actor.
        erd.accesses.forEach(function (a) {
          if (!ids[a.target] || (a.mode !== "read" && a.mode !== "write")) return;
          a.functions.forEach(function (f) {
            var actor = byId[f.actor];
            if (!codeMember(actor) || !allowed(actor, view)) return;
            if (!ids[actor.id]) { list.push(Object.assign({}, actor, { actorNode: true })); ids[actor.id] = true; }
            rels.push({ src: actor.id, dst: a.target, kind: a.mode, provenance: f.provenance || a.provenance });
          });
        });
      } else {
        var ownership = erd.relations.filter(function (r) { return r.kind === "member_of" && r.dst; });
        var owners = {};
        ownership.forEach(function (r) { if (codeMember(byId[r.src]) && allowed(byId[r.src], view)) owners[r.dst] = true; });
        list = erd.entities.filter(function (e) {
          return allowed(e, view) && (codeEntity(e) || owners[e.id] || showModules && e.kind === "module");
        });
        list.forEach(function (e) { ids[e.id] = true; });
        rels = ownership.filter(function (r) { return ids[r.src] && ids[r.dst]; })
          .map(function (r) { return { src: r.dst, dst: r.src, kind: "member_of", provenance: r.provenance }; });
        // A module owns its top-level declarations. Qualified ids give the
        // same containment when the extractor does not emit a defines edge.
        if (showModules) {
          list.forEach(function (e) {
            var mod = moduleId(e.id);
            if (e.id !== mod && ids[mod] && !ownership.some(function (r) { return r.src === e.id && ids[r.dst]; }))
              rels.push({ src: mod, dst: e.id, kind: "defines", provenance: "extracted" });
          });
          erd.relations.forEach(function (r) {
            if (r.kind === "imports" && ids[r.src] && ids[r.dst]) rels.push(r);
          });
        }
      }
      if (q) {
        list.forEach(function (e) { if ((e.id + " " + e.name).toLowerCase().indexOf(q) >= 0) match[e.id] = true; });
        var near = {};
        rels.forEach(function (r) {
          if (match[r.src]) near[r.dst] = true;
          if (match[r.dst]) near[r.src] = true;
        });
        list = list.filter(function (e) { return match[e.id] || near[e.id]; });
        ids = {};
        list.forEach(function (e) { ids[e.id] = true; });
        rels = rels.filter(function (r) { return ids[r.src] && ids[r.dst]; });
      }
      return { list: list, rels: rels, match: match };
    }

    function render(view) {
      var canvas = document.getElementById(view + "-canvas");
      canvas.innerHTML = "";
      var vis = graph(view);
      document.getElementById(view + "-count").textContent = vis.list.length + " nodes · " + vis.rels.length + " links";
      if (!vis.list.length) { canvas.innerHTML = "<p class='note'>No entities match.</p>"; return; }
      if (vis.list.length > 700) { canvas.innerHTML = "<p class='note'>" + vis.list.length + " nodes; filter to fewer than 700 to lay them out.</p>"; return; }
      var MAXF = view === "data" ? 10 : 0;
      var comps = components(vis.list, vis.rels);
      var box = sizeOf(canvas);
      var svg = d3.select(canvas).append("svg").attr("role", "img").attr("aria-label", view === "data" ? "Data model" : "Code ownership and imports");
      var root = svg.append("g");
      var line = d3.line().x(function (p) { return p.x; }).y(function (p) { return p.y; }).curve(d3.curveBasis);
      svg.append("defs").append("marker").attr("id", "arrow-" + view).attr("viewBox", "0 0 10 10").attr("refX", 9).attr("refY", 5)
        .attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto-start-reverse")
        .append("path").attr("d", "M0,0L10,5L0,10z").attr("fill", cssVar("--edge"));
      var laid = comps.map(function (c) { return layoutComponent(c.nodes, c.rels, MAXF); });
      var area = d3.sum(laid, function (l) { return l.w * l.h; });
      var rowWidth = Math.max(900, Math.sqrt(area) * 1.6, d3.max(laid, function (l) { return l.w; }) || 0);
      var x = 0, y = 0, rowH = 0;
      laid.forEach(function (l) {
        if (x > 0 && x + l.w > rowWidth) { x = 0; y += rowH + 30; rowH = 0; }
        drawComponent(root, l, x, y, vis.match, line, MAXF, view);
        x += l.w + 30;
        rowH = Math.max(rowH, l.h);
      });
      zoomable(svg, root);
      fitTransform(svg, root, box);
    }

    function components(list, rels) {
      var parent = {};
      function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
      list.forEach(function (e) { parent[e.id] = e.id; });
      rels.forEach(function (r) { parent[find(r.src)] = find(r.dst); });
      var groups = {};
      list.forEach(function (e) { var k = find(e.id); (groups[k] = groups[k] || { nodes: [], rels: [] }).nodes.push(e); });
      rels.forEach(function (r) { groups[find(r.src)].rels.push(r); });
      return Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) {
        return b.nodes.length - a.nodes.length || (a.nodes[0].id < b.nodes[0].id ? -1 : 1);
      });
    }

    function layoutComponent(nodes, rels, MAXF) {
      var g = new dagre.graphlib.Graph({ multigraph: true });
      g.setGraph({ rankdir: "LR", nodesep: 18, ranksep: 60, marginx: 0, marginy: 0 });
      g.setDefaultEdgeLabel(function () { return {}; });
      nodes.forEach(function (e) {
        var shown = (e.fields || []).slice(0, MAXF);
        var width = Math.max(textWidth(e.name, 12) + 20, textWidth(e.kind, 10) + 20, d3.max(shown, function (f) {
          return textWidth(f.name + (f.type_ref ? ": " + f.type_ref : ""), 11) + 16;
        }) || 0, 120);
        width = Math.min(width, 300);
        var height = 34 + shown.length * 14 + (MAXF && (e.fields || []).length > MAXF ? 14 : 0) + 6;
        if (e.actorNode) { width = Math.min(width, 190); height = 36; }
        g.setNode(e.id, { width: width, height: height, data: e });
      });
      rels.forEach(function (r, i) { g.setEdge(r.src, r.dst, { data: r, width: textWidth(r.kind, 10), height: 10, labelpos: "c" }, "r" + i); });
      dagre.layout(g);
      var gr = g.graph();
      return { g: g, w: gr.width || 120, h: gr.height || 40 };
    }

    function drawComponent(root, l, ox, oy, match, line, MAXF, view) {
      var g = l.g;
      var layer = root.append("g").attr("transform", "translate(" + ox + "," + oy + ")");
      g.edges().forEach(function (e) {
        var ed = g.edge(e), r = ed.data;
        layer.append("path").attr("class", (r.kind === "read" || r.kind === "write" ? "acc " + r.kind : "erd-rel") + " " + r.provenance)
          .attr("d", line(ed.points)).attr("marker-end", "url(#arrow-" + view + ")");
        layer.append("text").attr("class", "erd-rel-label").attr("x", ed.x).attr("y", ed.y + 3).attr("text-anchor", "middle").text(r.kind);
      });
      g.nodes().forEach(function (id) {
        var nd = g.node(id), e = nd.data;
        var grp = layer.append("g").attr("class", "erd-box" + (e.actorNode ? " actor" : "") + (e.test ? " test" : "") + (match[id] ? " match" : ""))
          .attr("transform", "translate(" + (nd.x - nd.width / 2) + "," + (nd.y - nd.height / 2) + ")").style("cursor", "pointer");
        grp.append("rect").attr("class", "body").attr("width", nd.width).attr("height", nd.height).attr("rx", 6)
          .attr("stroke-dasharray", e.provenance === "inferred" ? "5 4" : null);
        grp.append("rect").attr("class", "head").attr("x", 1).attr("y", 1).attr("width", nd.width - 2).attr("height", 30).attr("rx", 5);
        grp.append("text").attr("x", 8).attr("y", 14).attr("font-weight", 600).text(clip(e.name, nd.width - 16, 11));
        grp.append("text").attr("class", "kind").attr("x", 8).attr("y", 26).text(e.kind + (e.path ? " · " + e.path.split("/").pop() : ""));
        (e.fields || []).slice(0, MAXF).forEach(function (f, i) {
          grp.append("text").attr("x", 8).attr("y", 46 + i * 14)
            .text(clip(f.name + (f.type_ref ? ": " + f.type_ref : ""), nd.width - 16, 11));
        });
        if (MAXF && (e.fields || []).length > MAXF) grp.append("text").attr("class", "kind").attr("x", 8).attr("y", 46 + MAXF * 14).text("+" + (e.fields.length - MAXF) + " more");
        grp.on("click", function () { entityPanel(e, view); })
          .on("mousemove", function (ev) { showTip(ev, "<div class='t'>" + esc(e.id) + "</div><div class='s'>" + esc(e.kind) + " · " + (e.fields || []).length + " fields · " + esc(e.provenance) + "</div>"); })
          .on("mouseleave", hideTip);
      });
    }

    function clip(s, width, px) {
      var max = Math.max(3, Math.floor(width / (px * 0.6)));
      return s.length > max ? s.slice(0, max - 1) + "…" : s;
    }

    function entityPanel(e, view) {
      var rels = erd.relations.filter(function (r) { return r.src === e.id || r.dst === e.id; });
      var acc = [];
      erd.accesses.forEach(function (a) {
        if (a.target === e.id && (a.mode === "read" || a.mode === "write")) a.functions.forEach(function (f) { acc.push({ mode: a.mode, actor: f.actor, line: f.line, provenance: f.provenance }); });
      });
      var src = e.source ? e.source.path + ":" + e.source.line : (e.path || "");
      var html = "<h2 class='mono'>" + esc(e.name) + "</h2><p class='mono'>" + esc(e.id) + "</p><p>" + esc(e.kind) + " · " + esc(e.provenance) +
        (src ? " · <span class='mono'>" + esc(src) + "</span>" : "") + "</p>";
      html += "<h3>Fields (" + (e.fields || []).length + ")</h3>" + ((e.fields || []).length ? "<table><tbody>" + e.fields.map(function (f) {
        return "<tr><td class='mono'>" + esc(f.name) + "</td><td class='mono'>" + esc(f.type_ref || "") + (f.type_id ? " → " + esc(f.type_id) : "") + "</td></tr>";
      }).join("") + "</tbody></table>" : "<p class='empty'>None.</p>");
      html += "<h3>Relations (" + rels.length + ")</h3>" + (rels.length ? "<table><tbody>" + rels.map(function (r) {
        var other = r.src === e.id ? r.dst : r.src;
        return "<tr><td>" + (r.src === e.id ? "→" : "←") + " " + esc(r.kind) + "</td><td class='mono'>" + esc(other) + "</td><td>" + esc(r.provenance) + "</td></tr>";
      }).join("") + "</tbody></table>" : "<p class='empty'>None.</p>");
      html += "<h3>Read or written by (" + acc.length + ")</h3>" + (acc.length ? "<table><tbody>" + acc.map(function (a) {
        return "<tr><td>" + esc(a.mode) + "</td><td class='mono'>" + esc(a.actor) + (a.line ? ":" + a.line : "") + "</td></tr>";
      }).join("") + "</tbody></table>" : "<p class='empty'>No resolved accesses.</p>");
      if (view === "code") {
        var members = erd.relations.filter(function (r) { return r.kind === "member_of" && r.dst === e.id && allowed(byId[r.src], view); })
          .map(function (r) { return byId[r.src]; });
        if (e.kind === "module") members = members.concat(erd.entities.filter(function (item) {
          return item.id !== e.id && moduleId(item.id) === e.id && item.id.indexOf("::") >= 0 &&
            item.id.split("::")[1].indexOf(".") < 0 && allowed(item, view) && members.indexOf(item) < 0;
        }));
        html += "<h3>Members (" + members.length + ")</h3>" + (members.length ? "<ul>" + members.map(function (m) {
          return "<li class='mono'>" + esc(m.name) + " <span class='empty'>" + esc(m.kind) + "</span></li>";
        }).join("") + "</ul>" : "<p class='empty'>None.</p>");
        var subscribers = [e].concat(members).filter(codeMember);
        var subs = subscribers.map(function (m) { return { actor: m.name, events: subscriptionIds(m.id) }; })
          .filter(function (row) { return row.events.length; });
        html += "<h3>Event subscriptions (" + subs.reduce(function (n, row) { return n + row.events.length; }, 0) + ")</h3>" +
          (subs.length ? "<ul>" + subs.map(function (row) { return row.events.map(function (id) {
            return "<li class='mono'>" + esc(row.actor) + " → " + esc((byId[id] || {}).name || id) + "</li>";
          }).join(""); }).join("") + "</ul>" : "<p class='empty'>None.</p>");
      }
      document.getElementById(view + "-panel").innerHTML = html;
    }
    return { render: render };
  })();

  render("treemap");
})();
