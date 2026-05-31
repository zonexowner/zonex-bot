document.addEventListener("DOMContentLoaded", () => {
  const normalizePath = (value) => {
    if (!value) return "";
    const clean = value.split("#")[0].split("?")[0];
    if (!clean) return "";
    return clean.endsWith("/") ? `${clean}index.html` : clean;
  };

  const applyActiveNavigationState = () => {
    const currentPath = normalizePath(window.location.pathname || "/");
    const navLinks = document.querySelectorAll("header nav a, .nav-link-node");

    navLinks.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const linkPath = normalizePath(href);
      const isHomePage = currentPath === "/" || currentPath.endsWith("index.html");
      const isMatch =
        (linkPath && currentPath && linkPath.endsWith(currentPath) && currentPath !== "/") ||
        (isHomePage && (linkPath === "index.html" || linkPath === "/index.html" || linkPath === "/"));

      if (isMatch) {
        link.classList.add("text-[#00ff7f]", "font-medium");
        link.classList.remove("text-[#888888]", "text-zinc-400");
        if (!link.querySelector(".nav-indicator")) {
          link.insertAdjacentHTML(
            "afterbegin",
            '<span class="nav-indicator mr-1 select-none font-mono text-[10px] text-[#00ff7f]/40">·</span>'
          );
        }
      } else {
        link.classList.remove("text-[#00ff7f]", "font-medium");
        const indicator = link.querySelector(".nav-indicator");
        if (indicator) indicator.remove();
      }
    });
  };

  const initializeScrollReveal = () => {
    const revealTargets = document.querySelectorAll(
      "section:not(.no-reveal), .reveal-element, #bot-info, #testimonials, #checkout-terminal, .strategy-card"
    );

    revealTargets.forEach((target) => {
      if (!target.classList.contains("reveal-initialized")) {
        target.style.opacity = "0";
        target.style.transform = "translateY(16px)";
        target.style.transition =
          "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)";
        target.classList.add("reveal-initialized");
      }
    });

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target;
            target.style.opacity = "1";
            target.style.transform = "translateY(0)";
            observer.unobserve(target);
          }
        });
      },
      {
        root: null,
        threshold: 0.05,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    revealTargets.forEach((target) => revealObserver.observe(target));
  };

  const initializeMobileNav = () => {
    const toggle = document.querySelector(".nav-menu-btn");
    const drawer = document.querySelector(".mobile-nav-drawer");
    if (!toggle || !drawer) return;

    const close = () => {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      drawer.classList.remove("is-open");
      drawer.hidden = true;
    };

    const open = () => {
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      drawer.hidden = false;
      requestAnimationFrame(() => drawer.classList.add("is-open"));
    };

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      if (expanded) close();
      else open();
    });

    drawer.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", close);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  };

  const initializeLivePill = () => {
    const pill = document.getElementById("live-cta-pill");
    if (!pill) return;

    const bottomCta = document.getElementById("bottom-cta");
    if (!bottomCta) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          pill.classList.toggle("is-hidden", entry.isIntersecting);
        });
      },
      { threshold: 0.35 }
    );

    observer.observe(bottomCta);
  };

  applyActiveNavigationState();
  initializeScrollReveal();
  initializeMobileNav();
  initializeLivePill();
});
