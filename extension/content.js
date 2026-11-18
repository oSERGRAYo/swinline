(() => {
  const assetFiles = new Map([
    ["winline", "swinline-logo.svg"],
    ["hero-1280", "swinline-hero.png"],
    ["hero-2560", "swinline-hero.png"],
    ["new-ticker", "swinline-ticket.png"],
    ["photo-1", "swinline-host.png"],
    ["photo-2", "swinline-presenter.png"],
    ["photo-6", "swinline-winner.png"],
  ]);
  const imageMarker = "data-swinline-image";
  const adMarker = "data-swinline-ad";
  const standinMarker = "data-swinline-standin";
  const gradeMarker = "data-swinline-grade";
  const introStageMarker = "data-swinline-intro-stage";
  const cssArrowMarker = "data-swinline-css-arrow";
  const replacementProperty = "--swinline-replacement";
  const labelAttrs = ["alt", "aria-label", "aria-description", "title", "placeholder"];
  const labelSelector = labelAttrs.map((attribute) => `[${attribute}]`).join(",");
  const headingSelector = 'h1,h2,h3,h4,h5,h6,[role="heading"],[class*="title" i],[class*="heading" i]';
  const heroVideoSelector = "video.hero__video";
  const arrowClassSelector = '[class*="arrow" i],[class*="next" i],[class*="prev" i]';
  const arrowSelector = `a[href],button,[role="button"],${arrowClassSelector}`;
  const candidateSelector = `img,${heroVideoSelector},[style],${headingSelector},${arrowSelector},${labelSelector}`;
  const loaderSelector = '[data-preloader],[data-loader],[id*="loader" i],[class*="loader" i]';
  const cssUrl = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi;
  const decorNames = /^(?:slider-arrow-(?:prev|next)|(?:figma-)?(?:grass|stone)-[\w-]+|(?:left|right)-(?:blur-)?\d+|(?:vote-flow|card)-decor-[\w-]+|bg(?:-2560)?|mask|gem)$/i;
  const nominationArt = /^(?:king|queen|cs|dota|game|next|irl|cup|bot|pair|w|song|cosplay|pcik|clown)_\d+_[a-f\d]+\.png$|^fhsaiugfh_[a-f\d]+\.png$/i;
  const excludedText = "script,style,template,noscript,textarea,[contenteditable]:not([contenteditable='false'])";
  const standins = new WeakMap();
  let introLogo;
  let introStage;

  function parseUrl(value) {
    if (!value?.trim()) return null;
    try {
      const url = new URL(value, document.baseURI);
      return ["http:", "https:"].includes(url.protocol) ? url : null;
    } catch {
      return null;
    }
  }

  function urlFor(file) {
    return chrome.runtime.getURL(`assets/replacements/${file}`);
  }

  function astroName(url) {
    return url.pathname.match(/\/_astro\/([^./]+)(?:\.[\w-]+)?\.(?:webp|png|avif|jpe?g)$/i)?.[1];
  }

  function matchingAsset(value) {
    const url = parseUrl(value);
    if (url?.hostname === "static.slay-award.ru") return assetFiles.get(astroName(url));
    return undefined;
  }

  function sourceFor(image) {
    if (image.hasAttribute("srcset") || image.parentElement?.localName === "picture") {
      return image.currentSrc;
    }
    return image.getAttribute("src");
  }

  function imageAsset(image) {
    const file = matchingAsset(sourceFor(image));
    if (file) return file;
    if (/^(?:s)?winline slay$/i.test(image.alt.trim())) return "swinline-intro.png";
    return undefined;
  }

  function markIntroStage(image) {
    let namedStage;
    let graphicsGroup;
    let fixedStage;
    for (let parent = image.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (parent.matches("main") || parent.querySelector("main,#nominations")) break;
      if (parent.matches(loaderSelector)) namedStage = parent;
      if (!graphicsGroup && [...parent.querySelectorAll("img,video,canvas,svg")].some((node) => node !== image)) {
        graphicsGroup = parent;
      }
      if (getComputedStyle(parent).position === "fixed") {
        fixedStage = parent;
        break;
      }
    }
    const stage = fixedStage ?? namedStage ?? graphicsGroup;
    if (!stage || stage === introStage) return;
    introStage?.removeAttribute(introStageMarker);
    introStage = stage;
    stage.setAttribute(introStageMarker, "");
  }

  function updateImage(image) {
    const file = imageAsset(image);
    setReplacement(image, file);
    if (file === "swinline-intro.png") {
      introLogo = image;
      markIntroStage(image);
    }
  }

  function updateHeroVideo(video) {
    if (matchingAsset(video.getAttribute("poster")) === "swinline-hero.png") {
      video.poster = urlFor("swinline-hero.png");
    }

    let changed = false;
    for (const source of [video, ...video.querySelectorAll("source[src]")]) {
      const url = parseUrl(source.getAttribute("src"));
      const clip = url?.hostname === "static.slay-award.ru" &&
        url.pathname.match(/\/videos\/(hero(?:-mobile)?)\.mp4$/)?.[1];
      if (clip) {
        source.src = urlFor(`swinline-${clip}.mp4`);
        changed = true;
      }
    }

    // A source selected by the browser before the swap needs a fresh load.
    // Otherwise let the site's original autoplay and source selection run.
    if (changed && video.currentSrc) {
      const resume = !video.paused && !matchMedia("(prefers-reduced-motion: reduce)").matches;
      video.load();
      if (resume) video.play().catch(() => {});
    }
  }

  function rename(value) {
    return value.replace(/\bwinline\b/gi, "Swinline");
  }

  function updateText(node) {
    if (!node.parentElement || node.parentElement.closest(excludedText)) return;
    const value = rename(node.data);
    if (value !== node.data) node.data = value;
  }

  function updateLabels(element) {
    for (const attribute of labelAttrs) {
      const original = element.getAttribute(attribute);
      if (original === null) continue;
      const updated = rename(original);
      if (original !== updated) element.setAttribute(attribute, updated);
    }
  }

  function setReplacement(element, file) {
    const previous = element.getAttribute(imageMarker);
    if (file) {
      const replacement = `url("${urlFor(file)}")`;
      if (element.style.getPropertyValue(replacementProperty) !== replacement) {
        element.style.setProperty(replacementProperty, replacement);
      }
      if (previous !== file) element.setAttribute(imageMarker, file);
    } else if (previous !== null) {
      element.removeAttribute(imageMarker);
      element.style.removeProperty(replacementProperty);
    }
  }

  function updateBackground(element) {
    const background = element.style?.backgroundImage;
    if (!background?.includes("/_astro/")) return;
    const updated = background.replace(cssUrl,
      (original, doubleQuoted, singleQuoted, unquoted) => {
        const file = matchingAsset(doubleQuoted ?? singleQuoted ?? unquoted);
        return file ? `url("${urlFor(file)}")` : original;
      });
    if (background !== updated) {
      element.style.setProperty("background-image", updated, element.style.getPropertyPriority("background-image"));
    }
  }

  function gradeForAsset(value) {
    const url = parseUrl(value);
    if (url?.hostname === "static.slay-award.ru") {
      const name = astroName(url);
      if (decorNames.test(name)) return "decor";
      if (/^20(?:23|24|25|26)-/.test(name)) return "glow";
    }
    if (url?.hostname === "media.slay-award.ru" && nominationArt.test(url.pathname.split("/").pop())) {
      return "decor";
    }
    return undefined;
  }

  function containsArrow(value) {
    for (const match of value?.matchAll(cssUrl) ?? []) {
      const url = parseUrl(match[1] ?? match[2] ?? match[3]);
      if (url && /^(?:static\.)?slay-award\.ru$/.test(url.hostname) &&
        /^slider-arrow-(?:next|prev)$/i.test(astroName(url))) return true;
    }
    return false;
  }

  function updateCssArrow(element) {
    if (!element.matches(arrowSelector) || element.localName === "img" ||
      element.hasAttribute(cssArrowMarker)) return;
    if (!element.matches(arrowClassSelector) && element.textContent.trim()) return;
    for (const pseudo of [null, "::before", "::after"]) {
      const style = getComputedStyle(element, pseudo);
      if (containsArrow(style.backgroundImage) || containsArrow(style.content) || containsArrow(style.maskImage)) {
        element.setAttribute(cssArrowMarker, "");
        return;
      }
    }
  }

  function visualGrade(element) {
    if (element.localName === "img") {
      return gradeForAsset(sourceFor(element));
    }
    if (element.matches(headingSelector)) {
      const labels = [element.getAttribute("aria-label"), element.textContent];
      if (labels.some((label) => label &&
        /^(?:(?:номинации2026)+|(?:streamlegendsawardsoftheyear)+|streamlegends|awardsoftheyear)$/
          .test(label.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")))) {
        return "heading";
      }
    }
    const background = element.style?.backgroundImage;
    for (const match of background?.matchAll(cssUrl) ?? []) {
      // Background decorations may be filtered as a group, but portrait
      // processing belongs to the individual image.
      if (gradeForAsset(match[1] ?? match[2] ?? match[3]) === "decor") return "decor";
    }
    return undefined;
  }

  function updateGrade(element) {
    const grade = visualGrade(element);
    if (grade) {
      if (element.getAttribute(gradeMarker) !== grade) element.setAttribute(gradeMarker, grade);
    } else {
      element.removeAttribute(gradeMarker);
    }
  }

  function removeStandin(anchor) {
    standins.get(anchor)?.remove();
    standins.delete(anchor);
  }

  function updateLink(anchor) {
    if (!anchor?.isConnected) return;
    const host = parseUrl(anchor.getAttribute("href"))?.hostname.replace(/\.$/, "");
    const advertisement = host === "winline.ru" || host?.endsWith(".winline.ru") === true;
    anchor.toggleAttribute(adMarker, advertisement);

    const image = advertisement && anchor.querySelector(`img[${imageMarker}]`);
    if (!image) {
      removeStandin(anchor);
      return;
    }

    const file = image.getAttribute(imageMarker);
    let standin = standins.get(anchor);
    if (!standin) {
      standin = document.createElement("img");
      standins.set(anchor, standin);
    }
    for (const attr of ["class", "width", "height"]) {
      const value = image.getAttribute(attr);
      if (value === null) standin.removeAttribute(attr);
      else if (standin.getAttribute(attr) !== value) standin.setAttribute(attr, value);
    }
    if (standin.getAttribute(standinMarker) !== file) {
      standin.setAttribute(standinMarker, file);
      standin.src = urlFor(file);
    }
    standin.alt = rename(image.getAttribute("alt") ?? "");
    if (anchor.nextSibling !== standin) anchor.after(standin);
  }

  function updateCandidates(nodes, links) {
    for (const element of nodes) {
      if (!element.isConnected || element.hasAttribute(standinMarker)) continue;
      updateLabels(element);
      updateBackground(element);
      updateGrade(element);
      updateCssArrow(element);
      if (element.localName === "img") updateImage(element);
      else if (element.matches(heroVideoSelector)) updateHeroVideo(element);
      const anchor = element.closest("a");
      if (anchor) links.add(anchor);
    }
    for (const anchor of links) updateLink(anchor);
  }

  function collect(root, candidates) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.isConnected) updateText(root);
      return;
    }
    if (!root.isConnected || !root.querySelectorAll || root.hasAttribute?.(standinMarker)) return;
    if (root.matches?.(candidateSelector)) candidates.add(root);
    for (const element of root.querySelectorAll(candidateSelector)) candidates.add(element);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) updateText(walker.currentNode);
  }

  function collectPictureImage(node, candidates) {
    const picture = node.closest("picture");
    const image = picture?.querySelector("img");
    if (image) candidates.add(image);
  }

  function collectHeadingAncestors(element, candidates) {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      if (node.matches(headingSelector)) candidates.add(node);
    }
  }

  const observer = new MutationObserver((mutations) => {
    const candidates = new Set();
    const links = new Set();
    let baseChanged = false;

    for (const mutation of mutations) {
      const { target } = mutation;
      if (mutation.type === "characterData") {
        if (target.isConnected) {
          updateText(target);
          collectHeadingAncestors(target.parentElement, candidates);
        }
      } else if (mutation.type === "attributes") {
        if (target.localName === "base") baseChanged = true;
        else if (target.localName === "source") {
          if (target.parentElement?.matches(heroVideoSelector)) candidates.add(target.parentElement);
          else collectPictureImage(target, candidates);
        }
        else candidates.add(target);
      } else {
        const anchor = target.closest?.("a");
        if (anchor) links.add(anchor);
        if (target.nodeType === Node.ELEMENT_NODE) collectHeadingAncestors(target, candidates);
        if (target.localName === "picture") collectPictureImage(target, candidates);
        else if (target.matches?.(heroVideoSelector)) candidates.add(target);
        for (const node of mutation.addedNodes) {
          if (node.matches?.("base[href]") || node.querySelector?.("base[href]")) baseChanged = true;
          collect(node, candidates);
        }
        for (const node of mutation.removedNodes) {
          if (node.matches?.("base[href]") || node.querySelector?.("base[href]")) baseChanged = true;
          if (node.matches?.(`a[${adMarker}]`)) removeStandin(node);
          for (const anchor of node.querySelectorAll?.(`a[${adMarker}]`) ?? []) removeStandin(anchor);
        }
      }
    }

    if (baseChanged) {
      for (const element of document.querySelectorAll(`a[href],img,${heroVideoSelector},[style]`)) candidates.add(element);
    }
    updateCandidates(candidates, links);
    if (introLogo?.isConnected && !introStage?.isConnected) markIntroStage(introLogo);
  });

  function onResourceRequestFinished({ target, type }) {
    if (type === "load" && target.matches?.('link[rel~="stylesheet"]')) {
      refreshLoadedStyles();
      return;
    }
    if (target.localName !== "img" || target.hasAttribute(standinMarker)) return;
    updateGrade(target);
    updateImage(target);
    updateLink(target.closest("a"));
  }

  document.addEventListener("load", onResourceRequestFinished, true);
  document.addEventListener("error", onResourceRequestFinished, true);
  function refreshLoadedStyles() {
    document.querySelectorAll(arrowSelector).forEach(updateCssArrow);
    document.querySelectorAll(`img[${imageMarker}="swinline-intro.png"]`).forEach(markIntroStage);
  }
  document.addEventListener("DOMContentLoaded", refreshLoadedStyles, { once: true });
  window.addEventListener("load", refreshLoadedStyles, { once: true });
  observer.observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributeFilter: ["href", "src", "srcset", "sizes", "media", "type", "poster", "style", ...labelAttrs],
  });
  const initial = new Set();
  collect(document, initial);
  updateCandidates(initial, new Set());
})();
