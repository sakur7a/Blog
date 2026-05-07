(function () {
  var toggle = document.getElementById("J_theme_toggle");
  if (!toggle) return;

  var root = document.documentElement;
  var storageKey = "sakura-theme";

  function storedTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch (error) {
      return "";
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch (error) {}
  }

  function currentTheme() {
    return root.getAttribute("data-theme") || storedTheme() || "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    toggle.textContent = theme === "dark" ? "Light" : "Dark";
    toggle.setAttribute("aria-label", theme === "dark" ? "切换浅色模式" : "切换深色模式");
    toggle.setAttribute("title", theme === "dark" ? "切换浅色模式" : "切换深色模式");
  }

  applyTheme(currentTheme());
  toggle.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    saveTheme(next);
  });
})();

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

  function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value);
    }

    var textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    return Promise.resolve();
  }

  function latexWithDelimiters(item) {
    if (item.display) return "$$\n" + item.math + "\n$$";
    return "$" + item.math + "$";
  }

  function createMathCopyIcon(name) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute(
      "d",
      name === "check"
        ? "M20 6 9 17l-5-5"
        : "M8 8h10v10H8z M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
    );
    svg.appendChild(path);
    return svg;
  }

  function setMathCopyButtonState(button, copied) {
    button.replaceChildren(createMathCopyIcon(copied ? "check" : "copy"));
    button.setAttribute("data-copied", copied ? "true" : "false");
  }

  function normalizeCopyText(root) {
    var clone = root.cloneNode(true);

    Array.from(clone.querySelectorAll(".math-copy-button")).forEach(function (button) {
      button.remove();
    });

    Array.from(clone.querySelectorAll(".math-copy-wrap")).forEach(function (wrapper) {
      var latex = wrapper.getAttribute("data-latex") || "";
      wrapper.replaceWith(document.createTextNode("\n\n" + latex + "\n\n"));
    });

    Array.from(clone.querySelectorAll("mjx-container")).forEach(function (node) {
      var latex = node.getAttribute("data-latex") || "";
      if (latex) node.replaceWith(document.createTextNode(latex));
    });

    return clone.innerText
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
  }

  function enhanceMathCopy() {
    var mathItems = window.MathJax && window.MathJax.startup && window.MathJax.startup.document
      ? Array.from(window.MathJax.startup.document.math || [])
      : [];

    mathItems.forEach(function (item) {
      if (!item.typesetRoot) return;

      var latex = latexWithDelimiters(item);
      item.typesetRoot.setAttribute("data-latex", latex);
      item.typesetRoot.setAttribute("aria-label", latex);

      if (!item.display || item.typesetRoot.closest(".math-copy-wrap")) return;

      var mathNode = item.typesetRoot;
      var wrapper = document.createElement("div");
      wrapper.className = "math-copy-wrap";
      wrapper.setAttribute("data-latex", latex);

      var button = document.createElement("button");
      button.type = "button";
      button.className = "math-copy-button";
      button.setAttribute("aria-live", "polite");
      button.setAttribute("aria-label", "复制 LaTeX 公式");
      button.setAttribute("title", "复制 LaTeX 公式");
      button.setAttribute("data-latex", latex);
      setMathCopyButtonState(button, false);

      button.addEventListener("click", function () {
        copyText(latex).then(function () {
          setMathCopyButtonState(button, true);
          window.setTimeout(function () {
            setMathCopyButtonState(button, false);
          }, 1200);
        });
      });

      mathNode.parentNode.insertBefore(wrapper, mathNode);
      wrapper.appendChild(mathNode);
      wrapper.appendChild(button);
    });
  }

  document.addEventListener("copy", function (event) {
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    var range = selection.getRangeAt(0);
    if (typeof range.intersectsNode === "function") {
      if (!range.intersectsNode(content)) return;
    } else if (!content.contains(range.commonAncestorContainer)) {
      return;
    }

    var fragment = range.cloneContents();
    var holder = document.createElement("div");
    holder.appendChild(fragment);
    var text = normalizeCopyText(holder);
    if (!text) return;

    event.preventDefault();
    event.clipboardData.setData("text/plain", text);
  });

  function scheduleMathCopyEnhancement() {
    var attempts = 0;
    function tryEnhance() {
      attempts += 1;
      enhanceMathCopy();
      if (!document.querySelector(".math-copy-button") && attempts < 20) {
        window.setTimeout(tryEnhance, 120);
      }
    }
    tryEnhance();
  }

  window.MathJax = window.MathJax || {
    tex: {
      inlineMath: [["$", "$"], ["\\(", "\\)"]],
      displayMath: [["$$", "$$"], ["\\[", "\\]"]],
      processEscapes: true
    },
    options: {
      enableMenu: false,
      skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      renderActions: {
        addMenu: []
      }
    },
    startup: {
      ready: function () {
        if (window.MathJax.startup.defaultReady) {
          window.MathJax.startup.defaultReady();
        }
        scheduleMathCopyEnhancement();
      }
    }
  };

  if (document.getElementById("J_mathjax")) return;

  var script = document.createElement("script");
  script.id = "J_mathjax";
  script.async = true;
  script.src = currentScript && currentScript.src
    ? new URL("../vendor/mathjax/tex-svg.js", currentScript.src).toString()
    : "/assets/vendor/mathjax/tex-svg.js";
  script.addEventListener("load", scheduleMathCopyEnhancement);
  document.head.appendChild(script);
  window.setTimeout(scheduleMathCopyEnhancement, 600);
})();
