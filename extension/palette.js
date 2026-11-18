(() => {
  if (matchMedia("(forced-colors: active)").matches) return;

  const linkSelector = 'link[rel~="stylesheet"][href]';
  const candidates = `${linkSelector},style,[style]`;
  const links = new Map();
  const copies = new WeakSet();
  const colorCache = new Map();
  const colorParser = document.createElement("canvas").getContext("2d");
  if (!colorParser) return;

  const paintProperty = /^(?:--|(?:-[a-z]+-)?(?:[a-z]+-)*color$|(?:background|border|outline|box-shadow|text-shadow|filter|fill|stroke)(?:-|$))/;
  // Skip URLs, quoted strings and comments, even if they contain a color-like token.
  const colorToken = /\/\*[\s\S]*?\*\/|url\(\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:\\.|[^)])*)\s*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?<color>#[\da-f]{3,8}\b|(?:rgba?|hsla?)\([^()]*\)|(?<![\w-])(?:orange|darkorange|orangered|coral|sandybrown|peachpuff|tomato)(?![\w-]))/gi;
  const palette = new Map([
    ["255,106,19", [255, 168, 197]],
    ["255,138,61", [255, 194, 216]],
    ["201,74,0", [196, 83, 135]],
    ["246,156,78", [255, 218, 234]],
    ["217,73,34", [255, 159, 190]],
    ["255,240,229", [255, 240, 248]],
    ["114,50,15", [116, 52, 82]],
    ["61,28,11", [61, 27, 46]],
    ["20,12,8", [20, 12, 17]],
    ["12,8,6", [12, 8, 11]],
    ["7,6,5", [7, 6, 7]],
  ]);

  function pinkColor(token) {
    if (colorCache.has(token)) return colorCache.get(token);

    let result = token;
    colorParser.fillStyle = "#010203";
    colorParser.fillStyle = token;
    const parsed = colorParser.fillStyle;
    const channels = parsed.startsWith("#")
      ? parsed.slice(1).match(/../g).map((part) => Number.parseInt(part, 16))
      : parsed.match(/[\d.]+/g)?.map(Number);
    if (channels?.length >= 3) {
      const [red, green, blue, alpha = 1] = channels;
      let pink = palette.get(`${red},${green},${blue}`);
      const chroma = red - blue;
      const hue = (green - blue) / chroma;
      if (!pink && chroma >= 12 && red - green >= 6 && hue >= .10 && hue <= .85) {
        const pinkGreen = red - .44 * (red - green) - .13 * chroma;
        const pinkBlue = pinkGreen + .225 * (red - pinkGreen) + .05 * chroma;
        pink = [red, Math.round(pinkGreen), Math.round(pinkBlue)];
      }
      if (pink) result = `rgb(${pink.join(" ")}${alpha === 1 ? "" : ` / ${alpha}`})`;
    }
    colorCache.set(token, result);
    return result;
  }

  function rewriteDeclaration(style) {
    if (!style) return 0;
    let changes = 0;
    for (const property of Array.from(style)) {
      if (!paintProperty.test(property)) continue;
      const before = style.getPropertyValue(property);
      const after = before.replace(colorToken, (match, color) => color ? pinkColor(color) : match);
      if (after !== before) {
        style.setProperty(property, after, style.getPropertyPriority(property));
        changes++;
      }
    }
    return changes;
  }

  function rewriteSheet(sheet) {
    let rules;
    try {
      rules = sheet?.cssRules;
    } catch (error) {
      if (error.name === "SecurityError") return null;
      throw error;
    }
    if (!rules) return null;

    function walk(group) {
      let changes = 0;
      for (const rule of group) {
        changes += rewriteDeclaration(rule.style);
        if (rule.cssRules) changes += walk(rule.cssRules);
      }
      return changes;
    }

    return walk(rules);
  }

  function forgetLink(link, entry) {
    links.delete(link);
    entry.copy?.remove();
    if (entry.active) link.disabled = false;
  }

  function checkLink(link) {
    if (copies.has(link)) return;
    const previous = links.get(link);
    if (previous?.url === link.href && link.matches(linkSelector)) {
      if (previous.active && previous.copy.media !== link.media) previous.copy.media = link.media;
      return;
    }
    if (previous) forgetLink(link, previous);
    if (!link.isConnected || !link.matches(linkSelector) || link.disabled || link.relList.contains("alternate")) return;

    const url = new URL(link.href);
    if (url.protocol !== "https:" || !["slay-award.ru", "static.slay-award.ru"].includes(url.hostname)) return;
    if (rewriteSheet(link.sheet) !== null) {
      links.set(link, { url: link.href });
      return;
    }
    if (url.origin === location.origin || link.hasAttribute("crossorigin")) return;

    // The CDN allows anonymous CORS. Load an inactive copy in the same
    // cascade position, then swap only after its rules are readable and changed.
    const copy = link.cloneNode(false);
    copies.add(copy);
    copy.removeAttribute("id");
    copy.crossOrigin = "anonymous";
    copy.media = "not all";
    const entry = { url: link.href, copy };
    links.set(link, entry);

    copy.addEventListener("load", () => {
      if (!link.isConnected || links.get(link) !== entry || link.href !== entry.url || !rewriteSheet(copy.sheet)) {
        copy.remove();
        return;
      }
      copy.media = link.media;
      link.disabled = true;
      entry.active = true;
    }, { once: true });
    copy.addEventListener("error", () => copy.remove(), { once: true });
    link.after(copy);
  }

  function visit(element) {
    if (element.localName === "link") checkLink(element);
    if (element.localName === "style") rewriteSheet(element.sheet);
    if (element.hasAttribute("style")) rewriteDeclaration(element.style);
  }

  document.addEventListener("load", ({ target }) => {
    if (target.matches?.(linkSelector)) checkLink(target);
  }, true);

  const observer = new MutationObserver((mutations) => {
    let structureChanged = false;
    for (const change of mutations) {
      if (change.type === "attributes") {
        if (change.attributeName === "style") rewriteDeclaration(change.target.style);
        else if (change.target.localName === "link") checkLink(change.target);
      } else if (change.type === "characterData") {
        if (change.target.parentElement?.localName === "style") visit(change.target.parentElement);
      } else {
        structureChanged = true;
        if (change.target.localName === "style") visit(change.target);
        for (const node of change.addedNodes) {
          if (node.matches?.(candidates)) visit(node);
          node.querySelectorAll?.(candidates).forEach(visit);
        }
      }
    }
    if (structureChanged) {
      for (const [link, entry] of links) {
        if (!link.isConnected) forgetLink(link, entry);
      }
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributeFilter: ["style", "href", "rel", "media"],
  });
  document.querySelectorAll(candidates).forEach(visit);
})();
