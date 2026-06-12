(function () {
  var toggle = document.getElementById("J_theme_toggle");
  if (!toggle) return;

  var root = document.documentElement;
  var storageKey = "sakura-theme";

  var moonPath = "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z";
  var sunPath = "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42";

  function storedTheme() {
    try { return localStorage.getItem(storageKey); }
    catch (error) { return ""; }
  }

  function saveTheme(theme) {
    try { localStorage.setItem(storageKey, theme); }
    catch (error) {}
  }

  function currentTheme() {
    return root.getAttribute("data-theme") || storedTheme() || "light";
  }

  function setIcon(theme) {
    var icon = document.getElementById("J_theme_icon");
    if (!icon) return;
    var path = icon.querySelector("path");
    if (!path) return;
    var isDark = theme === "dark";
    path.setAttribute("d", isDark ? sunPath : moonPath);
    toggle.setAttribute("aria-label", isDark ? "切换浅色模式" : "切换深色模式");
    toggle.setAttribute("title", isDark ? "切换浅色模式" : "切换深色模式");
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    setIcon(theme);
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

/* Header scroll hide (matches tw93) */
(function () {
  var header = document.getElementById("J_header");
  if (!header) return;

  var isMobile = /Android|iPhone|Windows Phone|iPad|iPod/.test(navigator.userAgent);
  if (isMobile) return;

  var before = document.documentElement.scrollTop;
  window.addEventListener("scroll", function () {
    var after = document.documentElement.scrollTop;
    var delta = after - before;
    if (delta > 0 && after > 0) {
      header.classList.add("header-menu-overflow");
    } else {
      header.classList.remove("header-menu-overflow");
    }
    before = after;
  }, { passive: true });
})();

(function () {
  var open = document.getElementById("search-btn");
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
      var tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
      return (item.title + " " + item.summary + " " + tags).toLowerCase().indexOf(query) !== -1;
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

  var headings = Array.prototype.slice.call(content.querySelectorAll("h2, h3, h4"));
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
    var tag = heading.tagName.toLowerCase();
    if (tag === "h4") {
      item.className = "toc-level-4";
    } else if (tag === "h3") {
      item.className = "toc-level-3";
    } else {
      item.className = "toc-level-2";
    }

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
  document.body.classList.add("has-post-toc");

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
  if (!content || (content.textContent.indexOf("$") === -1 && content.textContent.indexOf("\\[") === -1)) return;
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


  /* Selective copy: only replace MathJax with LaTeX, leave everything else natural */
  content.addEventListener("copy", function (event) {
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    var range = selection.getRangeAt(0);
    if (!range.intersectsNode(content)) return;

    var fragment = range.cloneContents();
    var holder = document.createElement("div");
    holder.appendChild(fragment);

    // Remove copy buttons from clone
    holder.querySelectorAll(".math-copy-button").forEach(function (btn) { btn.remove(); });

    // Replace MathJax containers with LaTeX source
    var hasMath = false;
    holder.querySelectorAll("mjx-container").forEach(function (node) {
      var latex = node.getAttribute("data-latex");
      if (latex) {
        node.replaceWith(document.createTextNode(latex));
        hasMath = true;
      }
    });

    // Replace math-copy-wrap with its LaTeX
    holder.querySelectorAll(".math-copy-wrap").forEach(function (wrapper) {
      var latex = wrapper.getAttribute("data-latex");
      if (latex) {
        wrapper.replaceWith(document.createTextNode(latex));
        hasMath = true;
      }
    });

    // Only intercept if selection actually contained math
    if (!hasMath) return;

    var text = holder.innerText
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();

    if (!text) return;

    event.preventDefault();
    event.clipboardData.setData("text/plain", text);
  });

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

/* Code block copy button (tw93 style) */
(function () {
  var highlights = document.querySelectorAll(".highlighter-rouge > div.highlight");
  if (!highlights.length) return;

  highlights.forEach(function (highlight) {
    if (highlight.querySelector(".highlight-header")) return;

    var code = highlight.querySelector("code");
    var language = "";

    if (code) {
      language = code.getAttribute("data-lang") || "";
      if (!language && code.className) {
        var match = code.className.match(/language-([a-z0-9_+.-]+)/i);
        language = match ? match[1] : "";
      }
    }

    var header = document.createElement("div");
    header.className = "highlight-header";
    header.innerHTML =
      '<div class="highlight-dots">' +
      '<span class="dot-red"></span><span class="dot-yellow"></span><span class="dot-green"></span>' +
      "</div>" +
      '<span class="highlight-lang">' + language + "</span>" +
      '<span class="copy-btn">Copy</span>';
    highlight.insertBefore(header, highlight.firstChild);

    var copyBtn = header.querySelector(".copy-btn");
    copyBtn.addEventListener("click", function () {
      var pre = highlight.querySelector("pre");
      if (!pre) return;
      navigator.clipboard.writeText(pre.innerText).then(function () {
        copyBtn.textContent = "✓ Copied";
        copyBtn.style.color = "#27c93f";
        setTimeout(function () {
          copyBtn.textContent = "Copy";
          copyBtn.style.color = "";
        }, 2000);
      })["catch"](function () {
        copyBtn.textContent = "✗ Failed";
        setTimeout(function () {
          copyBtn.textContent = "Copy";
        }, 2000);
      });
    });
  });
})();

// Tags page filtering
(function () {
  var cloud = document.querySelector(".tag-cloud");
  var groups = document.querySelectorAll(".tag-group");
  if (!cloud || !groups.length) return;

  var items = cloud.querySelectorAll(".tag-cloud-item");

  function activateTag(tag) {
    items.forEach(function (item) {
      item.classList.toggle("active", item.getAttribute("data-tag") === tag);
    });
    groups.forEach(function (group) {
      group.hidden = tag && group.getAttribute("data-tag") !== tag;
    });
  }

  cloud.addEventListener("click", function (event) {
    var item = event.target.closest(".tag-cloud-item");
    if (!item) return;
    event.preventDefault();
    var tag = item.getAttribute("data-tag");
    var current = cloud.querySelector(".tag-cloud-item.active");
    var next = current && current.getAttribute("data-tag") === tag ? "" : tag;
    activateTag(next);
    history.replaceState(null, "", next ? "#" + tag : window.location.pathname);
  });

  // Auto-activate from hash
  if (window.location.hash) {
    activateTag(decodeURIComponent(window.location.hash.slice(1)));
  }
})();

/* PhotoSwipe lightbox for all content images */
(function () {
  var zoomImgs = document.querySelectorAll(".entry-content img, .moment-body img");
  if (!zoomImgs.length) return;

  var vendorBase = (function () {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute("src") || "";
      var idx = src.indexOf("assets/js/site.js");
      if (idx !== -1) return src.slice(0, idx) + "assets/vendor/photoswipe/";
    }
    return "/assets/vendor/photoswipe/";
  })();

  function loadCSS(href) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src, callback) {
    var script = document.createElement("script");
    script.src = src;
    script.onload = callback;
    document.body.appendChild(script);
  }

  loadCSS(vendorBase + "photoswipe.css");

  loadScript(vendorBase + "photoswipe.umd.min.js", function () {
    loadScript(vendorBase + "photoswipe-lightbox.umd.min.js", function () {
      var lightbox = new PhotoSwipeLightbox({
        gallery: ".entry-content, .moment-body",
        children: "img",
        pswpModule: PhotoSwipe,
        bgOpacity: 0.92,
        padding: { top: 20, bottom: 20, left: 20, right: 20 },
        mainClass: "pswp--minimal"
      });

      lightbox.addFilter("domItemData", function (itemData, element) {
        if (!element) return itemData;
        if (element.classList.contains("emoji") || element.classList.contains("no-zoom")) return null;
        itemData.src = element.getAttribute("data-pswp-src") || element.currentSrc || element.src;
        itemData.w = element.naturalWidth || window.innerWidth;
        itemData.h = element.naturalHeight || window.innerHeight;
        itemData.msrc = element.src;
        return itemData;
      });

      lightbox.on("uiRegister", function () {
        lightbox.pswp.ui.registerElement({
          name: "custom-caption",
          order: 9,
          isButton: false,
          appendTo: "root",
          html: "",
          onInit: function (el, pswp) {
            pswp.on("change", function () {
              var curr = pswp.currSlide.data.element;
              var alt = curr ? (curr.getAttribute("alt") || "") : "";
              el.innerHTML = alt ? '<div class="pswp-caption">' + alt + "</div>" : "";
            });
          }
        });
      });

      lightbox.init();
    });
  });
})();
