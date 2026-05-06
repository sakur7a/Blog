(function () {
  var canvas = document.getElementById("J_firework_canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var particles = [];
  var colors = ["#6ee7b7", "#93c5fd", "#fde68a", "#fca5a5"];

  function resize() {
    var rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function spawn() {
    var rect = canvas.getBoundingClientRect();
    var x = Math.random() * rect.width;
    var y = 40 + Math.random() * (rect.height - 80);
    for (var i = 0; i < 18; i += 1) {
      particles.push({
        x: x,
        y: y,
        vx: Math.cos((Math.PI * 2 * i) / 18) * (0.7 + Math.random() * 1.6),
        vy: Math.sin((Math.PI * 2 * i) / 18) * (0.7 + Math.random() * 1.6),
        life: 42,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  function tick() {
    var rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (Math.random() < 0.018) spawn();

    particles = particles.filter(function (p) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.018;
      p.life -= 1;
      ctx.globalAlpha = Math.max(0, p.life / 42);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
      return p.life > 0;
    });

    ctx.globalAlpha = 1;
    window.requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", resize);
  window.requestAnimationFrame(tick);
})();

(function () {
  var open = document.getElementById("J_search_open");
  var close = document.getElementById("J_search_close");
  var panel = document.getElementById("J_search_panel");
  var input = document.getElementById("J_search_input");
  var results = document.getElementById("J_search_results");
  var index = null;

  if (!open || !close || !panel || !input || !results) return;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function render(items) {
    if (!items.length) {
      results.innerHTML = '<p class="search-empty">没有找到匹配文章</p>';
      return;
    }

    results.innerHTML = items.map(function (item) {
      return '<a class="search-result" href="' + item.url + '">' +
        "<strong>" + escapeHtml(item.title) + "</strong>" +
        "<span>【" + escapeHtml(item.date) + "】" + escapeHtml(item.summary) + "</span>" +
        "</a>";
    }).join("");
  }

  function search() {
    var query = input.value.trim().toLowerCase();
    if (!query) {
      render(index || []);
      return;
    }

    render((index || []).filter(function (item) {
      return (item.title + " " + item.summary).toLowerCase().indexOf(query) !== -1;
    }));
  }

  function show() {
    panel.hidden = false;
    document.body.style.overflow = "hidden";
    if (!index) {
      fetch(open.getAttribute("data-search-url") || "/search.json")
        .then(function (response) { return response.json(); })
        .then(function (data) {
          index = data;
          render(index);
        });
    } else {
      render(index);
    }
    window.setTimeout(function () { input.focus(); }, 20);
  }

  function hide() {
    panel.hidden = true;
    document.body.style.overflow = "";
    input.value = "";
  }

  open.addEventListener("click", show);
  close.addEventListener("click", hide);
  input.addEventListener("input", search);
  panel.addEventListener("click", function (event) {
    if (event.target === panel) hide();
  });
  window.addEventListener("keydown", function (event) {
    if (event.key === "/" && panel.hidden) {
      event.preventDefault();
      show();
    }
    if (event.key === "Escape" && !panel.hidden) hide();
  });
})();

(function () {
  var content = document.getElementById("post-content");
  var toc = document.querySelector(".post-toc");
  var nav = document.getElementById("post-toc-nav");

  if (!content || !toc || !nav) return;

  var headings = Array.prototype.slice.call(content.querySelectorAll("h2, h3"));
  if (!headings.length) return;

  function slugify(value, index) {
    var slug = String(value)
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "heading-" + index;
  }

  var used = {};
  var list = document.createElement("ol");
  var links = [];

  headings.forEach(function (heading, index) {
    var id = heading.id || slugify(heading.textContent, index + 1);
    if (used[id]) {
      used[id] += 1;
      id = id + "-" + used[id];
    } else {
      used[id] = 1;
    }
    heading.id = id;
    heading.setAttribute("tabindex", "-1");

    var item = document.createElement("li");
    item.className = heading.tagName.toLowerCase() === "h3" ? "toc-level-3" : "toc-level-2";

    var link = document.createElement("a");
    link.href = "#" + id;
    link.textContent = heading.textContent.trim();
    link.addEventListener("click", function () {
      setActive(link);
    });
    item.appendChild(link);
    list.appendChild(item);
    links.push(link);
  });

  nav.appendChild(list);
  toc.hidden = false;

  function setActive(activeLink) {
    links.forEach(function (link) {
      link.classList.toggle("is-active", link === activeLink);
      if (link === activeLink) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (activeLink && typeof activeLink.scrollIntoView === "function") {
      activeLink.scrollIntoView({ block: "nearest" });
    }
  }

  setActive(links[0]);

  if ("IntersectionObserver" in window) {
    var visibleHeadings = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          visibleHeadings[entry.target.id] = entry.intersectionRatio;
        } else {
          delete visibleHeadings[entry.target.id];
        }
      });

      var activeHeading = headings.find(function (heading) {
        return visibleHeadings[heading.id];
      });

      if (!activeHeading) {
        activeHeading = headings.slice().reverse().find(function (heading) {
          return heading.getBoundingClientRect().top <= window.innerHeight * 0.32;
        });
      }

      if (!activeHeading) activeHeading = headings[0];

      var activeLink = links.find(function (link) {
        return link.getAttribute("href") === "#" + activeHeading.id;
      });
      setActive(activeLink);
    }, {
      root: null,
      rootMargin: "-18% 0px -68% 0px",
      threshold: [0, 0.2, 0.6, 1]
    });

    headings.forEach(function (heading) {
      observer.observe(heading);
    });
  }

  var ticking = false;
  function updateActiveByScroll() {
    ticking = false;
    var threshold = window.innerHeight * 0.36;
    var activeHeading = headings[0];
    var closestDistance = Infinity;

    headings.forEach(function (heading) {
      var rect = heading.getBoundingClientRect();
      if (rect.top <= threshold) {
        activeHeading = heading;
        closestDistance = Math.abs(rect.top - threshold);
        return;
      }

      var distance = Math.abs(rect.top - threshold);
      if (distance < closestDistance) {
        closestDistance = distance;
        activeHeading = heading;
      }
    });

    var activeLink = links.find(function (link) {
      return link.getAttribute("href") === "#" + activeHeading.id;
    });
    setActive(activeLink);
  }

  function requestActiveUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateActiveByScroll);
  }

  window.addEventListener("scroll", requestActiveUpdate, { passive: true });
  window.addEventListener("resize", requestActiveUpdate);
  window.setTimeout(updateActiveByScroll, 80);
})();

(function () {
  var content = document.getElementById("post-content");
  if (!content || content.textContent.indexOf("$") === -1) return;
  var currentScript = document.currentScript;

  window.MathJax = window.MathJax || {
    tex: {
      inlineMath: [["$", "$"], ["\\(", "\\)"]],
      displayMath: [["$$", "$$"], ["\\[", "\\]"]],
      processEscapes: true
    },
    options: {
      skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"]
    }
  };

  if (document.getElementById("J_mathjax")) return;

  var script = document.createElement("script");
  script.id = "J_mathjax";
  script.async = true;
  script.src = currentScript && currentScript.src
    ? new URL("../vendor/mathjax/tex-svg.js", currentScript.src).toString()
    : "/assets/vendor/mathjax/tex-svg.js";
  document.head.appendChild(script);
})();
