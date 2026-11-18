(() => {
  const svgNamespace = "http://www.w3.org/2000/svg";

  function append(parent, name, attributes) {
    const element = document.createElementNS(svgNamespace, name);
    for (const [attribute, value] of Object.entries(attributes)) {
      element.setAttribute(attribute, value);
    }
    parent.append(element);
    return element;
  }

  function colorFilter(svg, id, masks, colors) {
    const filter = append(svg, "filter", {
      id,
      "color-interpolation-filters": "sRGB",
    });

    let combinedMask;
    for (const [index, alphaRow] of masks.entries()) {
      const result = `mask${index}`;
      append(filter, "feColorMatrix", {
        in: "SourceGraphic",
        type: "matrix",
        values: `0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   ${alphaRow}`,
        result,
      });
      if (combinedMask) {
        const intersection = `intersection${index}`;
        append(filter, "feComposite", {
          in: combinedMask, in2: result, operator: "in", result: intersection,
        });
        combinedMask = intersection;
      } else {
        combinedMask = result;
      }
    }

    append(filter, "feColorMatrix", {
      in: "SourceGraphic",
      type: "matrix",
      values: `1 0 0 0 0   ${colors}   0 0 0 1 0`,
      result: "pink",
    });
    append(filter, "feComposite", {
      in: "pink", in2: combinedMask, operator: "in", result: "pinkOrange",
    });
    append(filter, "feComposite", {
      in: "SourceGraphic", in2: combinedMask, operator: "out", result: "original",
    });
    append(filter, "feComposite", {
      in: "pinkOrange", in2: "original", operator: "arithmetic", k2: "1", k3: "1",
    });
  }

  function installFilter() {
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("data-swinline-color-filter", "");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");

    // Default: feather a narrow band of saturated orange (12°–49°).
    colorFilter(svg, "swinline-orange-to-pink", [
      "-2.4 12 -9.6 0 0", "9.84 -12 2.16 0 0", "3.15 0 -7 0 -0.35",
    ], ".46 .48 .06 0 0   .73 .1 .02 0 0");

    // The decorative gems span warm red to gold, including dark orange facets.
    const warmHue = ["2.4 20 -22.4 0 0", "17.6 -20 2.4 0 0"];
    const rose = ".21 .33 .34 0 0   .59 .14 .18 0 0";
    colorFilter(svg, "swinline-crystal-to-rose", [
      ...warmHue, "7.4 0 -10 0 -.10",
    ], rose);

    // Portrait backgrounds are baked into the images. Match dark, strongly
    // warm light while shielding the brighter and less saturated faces.
    colorFilter(svg, "swinline-glow-to-rose", [
      ...warmHue, "12.48 0 -26 0 0", "-6 0 0 0 2.85",
    ], rose);

    document.body.append(svg);
    document.documentElement.setAttribute("data-swinline-orange", "");
  }

  if (document.body) {
    installFilter();
  } else {
    const observer = new MutationObserver(() => {
      if (!document.body) return;
      observer.disconnect();
      installFilter();
    });
    observer.observe(document, { childList: true, subtree: true });
  }
})();
