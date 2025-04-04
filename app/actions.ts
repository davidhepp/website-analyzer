"use server";

import { parse } from "node-html-parser";
import { v4 as uuidv4 } from "uuid";
import { supabase, AnalysisResult, ColorInfo } from "@/lib/supabase";

// Remove the in-memory Map storage
// const analysisResults = new Map<string, AnalysisResult>()

export async function analyzeWebsite(url: string) {
  try {
    // Fetch the website content with improved headers
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      return { success: false };
    }

    const html = await response.text();
    const root = parse(html);

    // Extract colors with context
    const colors = await extractVisibleColors(root, html, url);

    // Detect frameworks
    const frameworks = detectFrameworks(html);

    // Extract images
    const images = extractImages(root, url);

    // Generate a unique ID for this analysis
    const id = uuidv4();

    // Create the analysis result
    const analysisResult: AnalysisResult = {
      id,
      url,
      colors,
      frameworks,
      images,
    };

    // Store the results in Supabase instead of Map
    const { error } = await supabase.from("analysis_results").insert({
      id,
      url,
      colors: JSON.stringify(colors),
      frameworks: JSON.stringify(frameworks),
      images: JSON.stringify(images),
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error storing analysis results:", error);
      return { success: false };
    }

    return { success: true, id };
  } catch (error) {
    console.error("Error analyzing website:", error);
    return { success: false };
  }
}

export async function getAnalysisResults(id: string) {
  try {
    // Fetch results from Supabase instead of Map
    const { data, error } = await supabase
      .from("analysis_results")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("Error fetching analysis results:", error);
      return null;
    }

    // Parse the stored JSON strings back to arrays
    return {
      colors: JSON.parse(data.colors || "[]"),
      frameworks: JSON.parse(data.frameworks || "[]"),
      images: JSON.parse(data.images || "[]"),
    };
  } catch (error) {
    console.error("Error retrieving analysis results:", error);
    return null;
  }
}

// Helper functions
async function extractVisibleColors(
  root: any,
  html: string,
  baseUrl: string
): Promise<ColorInfo[]> {
  const colorMap = new Map<string, Set<string>>();

  // Process buttons and links with special attention to their text content
  processButtonsAndLinks(root, colorMap);

  // Process other common UI elements
  processElement(root, "h1, h2, h3, h4, h5, h6", "Heading", colorMap);
  processElement(root, "p", "Paragraph", colorMap);
  processElement(
    root,
    "header, .header, [class*='header']",
    "Header",
    colorMap
  );
  processElement(
    root,
    "footer, .footer, [class*='footer']",
    "Footer",
    colorMap
  );
  processElement(
    root,
    "nav, .nav, .navbar, [class*='nav-']",
    "Navigation",
    colorMap
  );
  processElement(root, ".card, [class*='card']", "Card", colorMap);
  processElement(root, "input, select, textarea", "Form Element", colorMap);
  processElement(root, "body", "Body", colorMap);
  processElement(root, "section, .section", "Section", colorMap);
  processElement(root, ".container, .wrapper", "Container", colorMap);
  processElement(root, "svg, .icon, [class*='icon']", "Icon", colorMap);

  // Extract background colors from elements with background styles
  const elementsWithBg = root.querySelectorAll("[style*='background']");
  elementsWithBg.forEach((el: any) => {
    const style = el.getAttribute("style");
    if (style) {
      const colors = extractColorsFromStyle(style);
      colors.forEach((color) => {
        if (!colorMap.has(color)) {
          colorMap.set(color, new Set());
        }
        colorMap.get(color)?.add("Background");
      });
    }
  });

  // Extract colors from inline CSS in the HTML
  const styleElements = root.querySelectorAll("style");
  styleElements.forEach((style: any) => {
    const cssText = style.text || style.innerHTML;
    if (cssText) {
      const cssColors = extractCSSRuleColors(cssText);
      for (const [color, context] of cssColors) {
        if (!colorMap.has(color)) {
          colorMap.set(color, new Set());
        }
        colorMap.get(color)?.add(context);
      }
    }
  });

  // Extract colors from CSS variables
  const cssVarColors = extractCSSVariableColors(html);
  for (const [color, context] of cssVarColors) {
    if (!colorMap.has(color)) {
      colorMap.set(color, new Set());
    }
    colorMap.get(color)?.add(context);
  }

  // Try to fetch and analyze stylesheets
  try {
    const stylesheetLinks = root.querySelectorAll("link[rel='stylesheet']");
    for (const link of stylesheetLinks) {
      let href = link.getAttribute("href");
      if (href) {
        // Handle relative URLs
        if (href.startsWith("/")) {
          try {
            const url = new URL(baseUrl);
            href = `${url.origin}${href}`;
          } catch (e) {
            continue;
          }
        } else if (!href.startsWith("http")) {
          try {
            const url = new URL(baseUrl);
            href = `${url.origin}/${href}`;
          } catch (e) {
            continue;
          }
        }

        try {
          const cssResponse = await fetch(href, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          });

          if (cssResponse.ok) {
            const css = await cssResponse.text();

            // Extract colors from CSS rules
            const cssColors = extractCSSRuleColors(css);
            for (const [color, context] of cssColors) {
              if (!colorMap.has(color)) {
                colorMap.set(color, new Set());
              }
              colorMap.get(color)?.add(context);
            }

            // Look for specific class definitions like btn-primary
            if (
              css.includes(".btn-primary") ||
              css.includes(".btn.btn-primary")
            ) {
              // Extract the color from the CSS
              const primaryBtnMatch =
                css.match(
                  /\.btn-primary\s*{[^}]*background(-color)?:\s*([^;]+)/i
                ) ||
                css.match(
                  /\.btn\.btn-primary\s*{[^}]*background(-color)?:\s*([^;]+)/i
                );

              if (primaryBtnMatch && primaryBtnMatch[2]) {
                const colorValue = primaryBtnMatch[2].trim();
                const hexMatch = colorValue.match(/#([0-9a-f]{3,8})\b/i);

                if (hexMatch) {
                  // We found a color for .btn-primary
                  const btnColor = hexMatch[0].toLowerCase();

                  // Find all buttons with this class and add their text
                  const primaryButtons = root.querySelectorAll(
                    ".btn-primary, .btn.btn-primary"
                  );
                  primaryButtons.forEach((btn: any) => {
                    const btnText = extractTextContent(btn);
                    if (btnText) {
                      if (!colorMap.has(btnColor)) {
                        colorMap.set(btnColor, new Set());
                      }
                      colorMap.get(btnColor)?.add(`Button: "${btnText}"`);
                    }
                  });
                }
              }
            }
          }
        } catch (e) {
          // Skip if stylesheet can't be fetched
          console.error("Error fetching stylesheet:", e);
        }
      }
    }
  } catch (e) {
    console.error("Error processing stylesheets:", e);
  }

  // Convert the map to the expected format
  const result: ColorInfo[] = [];
  colorMap.forEach((contexts, color) => {
    result.push({
      value: color,
      context: Array.from(contexts).join(", "),
    });
  });

  return result;
}

// Special function to process buttons and links with better text extraction
function processButtonsAndLinks(root: any, colorMap: Map<string, Set<string>>) {
  // Process buttons
  const buttons = root.querySelectorAll("button, .btn, [class*='btn-'], a.btn");
  buttons.forEach((btn: any) => {
    // Get button text with improved extraction
    const btnText = extractTextContent(btn);

    // Create context with button text if available
    const buttonContext = btnText ? `Button: "${btnText}"` : "Button";

    // Check for inline styles
    const style = btn.getAttribute("style");
    if (style) {
      const colors = extractColorsFromStyle(style);
      colors.forEach((color) => {
        if (!colorMap.has(color)) {
          colorMap.set(color, new Set());
        }
        colorMap.get(color)?.add(buttonContext);
      });
    }

    // Check for button classes
    const classes = btn.getAttribute("class");
    if (classes) {
      const classNames = classes.split(/\s+/);

      // Special handling for btn-primary class
      if (
        classNames.includes("btn-primary") ||
        (classNames.includes("btn") && classNames.includes("primary"))
      ) {
        // This is likely a primary button, we'll add it with the common primary color
        const primaryColor = "#6366f1"; // Common primary color, will be overridden by actual CSS
        if (!colorMap.has(primaryColor)) {
          colorMap.set(primaryColor, new Set());
        }
        colorMap.get(primaryColor)?.add(buttonContext);
      }

      // Check for other color-related classes
      classNames.forEach((className: string) => {
        if (
          className.startsWith("text-") ||
          className.startsWith("bg-") ||
          className.startsWith("border-") ||
          className.includes("color")
        ) {
          if (!colorMap.has(className)) {
            colorMap.set(className, new Set());
          }
          colorMap.get(className)?.add(buttonContext);
        }
      });
    }
  });

  // Process links (not buttons)
  const links = root.querySelectorAll("a:not(.btn):not([class*='btn-'])");
  links.forEach((link: any) => {
    // Get link text with improved extraction
    const linkText = extractTextContent(link);

    // Create context with link text if available
    const linkContext = linkText ? `Link: "${linkText}"` : "Link";

    // Check for inline styles
    const style = link.getAttribute("style");
    if (style) {
      const colors = extractColorsFromStyle(style);
      colors.forEach((color) => {
        if (!colorMap.has(color)) {
          colorMap.set(color, new Set());
        }
        colorMap.get(color)?.add(linkContext);
      });
    }

    // Check for link classes
    const classes = link.getAttribute("class");
    if (classes) {
      const classNames = classes.split(/\s+/);

      // Check for color-related classes
      classNames.forEach((className: string) => {
        if (
          className.startsWith("text-") ||
          className.startsWith("bg-") ||
          className.startsWith("border-") ||
          className.includes("color")
        ) {
          if (!colorMap.has(className)) {
            colorMap.set(className, new Set());
          }
          colorMap.get(className)?.add(linkContext);
        }
      });
    }
  });
}

// Improved text content extraction function
function extractTextContent(element: any): string {
  // Try multiple methods to get text content
  let text = "";

  // Method 1: Use the text property
  if (element.text) {
    text = element.text;
  }
  // Method 2: Use the innerText property
  else if (element.innerText) {
    text = element.innerText;
  }
  // Method 3: Use the textContent property
  else if (element.textContent) {
    text = element.textContent;
  }
  // Method 4: Manually extract text from child nodes
  else {
    // Get all text nodes
    const textNodes: string[] = [];
    const traverse = (node: any) => {
      if (node.nodeType === 3) {
        // Text node
        textNodes.push(node.text);
      } else if (node.childNodes) {
        node.childNodes.forEach(traverse);
      }
    };

    traverse(element);
    text = textNodes.join(" ").trim();
  }

  // Clean up the text
  text = text.trim();

  // Remove extra whitespace and newlines
  text = text.replace(/\s+/g, " ").trim();

  // Limit length
  if (text.length > 50) {
    text = text.substring(0, 47) + "...";
  }

  return text;
}

function processElement(
  root: any,
  selector: string,
  contextLabel: string,
  colorMap: Map<string, Set<string>>
) {
  const elements = root.querySelectorAll(selector);
  elements.forEach((el: any) => {
    // Get the element's text content with improved extraction
    const textContent = extractTextContent(el);

    // Create a context that includes the text content if available
    const elementContext = textContent
      ? `${contextLabel}: "${textContent}"`
      : contextLabel;

    // Check inline style
    const style = el.getAttribute("style");
    if (style) {
      const colors = extractColorsFromStyle(style);
      colors.forEach((color) => {
        if (!colorMap.has(color)) {
          colorMap.set(color, new Set());
        }
        colorMap.get(color)?.add(elementContext);
      });
    }

    // Check for specific classes
    const classes = el.getAttribute("class");
    if (classes) {
      const classNames = classes.split(/\s+/);

      // Check for color-related classes
      classNames.forEach((className: string) => {
        if (
          className.startsWith("text-") ||
          className.startsWith("bg-") ||
          className.startsWith("border-") ||
          className.includes("color")
        ) {
          addColorToMap(className, elementContext, colorMap);
        }
      });
    }
  });
}

function extractColorsFromStyle(style: string): string[] {
  const colors: string[] = [];

  // Match hex colors
  const hexMatches = style.match(/#([0-9a-f]{3,8})\b/gi);
  if (hexMatches) {
    hexMatches.forEach((color) => colors.push(color.toLowerCase()));
  }

  // Match rgb/rgba colors
  const rgbMatches = style.match(/rgb$$\s*\d+\s*,\s*\d+\s*,\s*\d+\s*$$/gi);
  if (rgbMatches) {
    rgbMatches.forEach((color) => colors.push(color.toLowerCase()));
  }

  const rgbaMatches = style.match(
    /rgba$$\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*$$/gi
  );
  if (rgbaMatches) {
    rgbaMatches.forEach((color) => colors.push(color.toLowerCase()));
  }

  // Match named colors
  const namedColors = [
    "black",
    "white",
    "red",
    "green",
    "blue",
    "yellow",
    "purple",
    "orange",
    "pink",
    "gray",
    "grey",
    "brown",
    "cyan",
    "magenta",
  ];

  namedColors.forEach((color) => {
    if (
      style.includes(`color:${color}`) ||
      style.includes(`color: ${color}`) ||
      style.includes(`background:${color}`) ||
      style.includes(`background: ${color}`) ||
      style.includes(`background-color:${color}`) ||
      style.includes(`background-color: ${color}`)
    ) {
      colors.push(color);
    }
  });

  return colors;
}

function extractCSSVariableColors(html: string): [string, string][] {
  const results: [string, string][] = [];

  // Match CSS variables with color values
  const cssVarMatches =
    html.match(/--[\w-]+(-color|-bg|-background)?:\s*([^;]+)/gi) || [];
  cssVarMatches.forEach((match) => {
    const nameMatch = match.match(/--[\w-]+(-color|-bg|-background)?/);
    const valueMatch = match.match(/:\s*([^;]+)/);

    if (nameMatch && valueMatch) {
      const name = nameMatch[0];
      const value = valueMatch[1].trim();

      // Check if it's a color value
      if (value.match(/#([0-9a-f]{3,8})\b/i)) {
        const colorMatch = value.match(/#([0-9a-f]{3,8})\b/i);
        if (colorMatch) {
          results.push([colorMatch[0].toLowerCase(), `CSS Variable (${name})`]);
        }
      } else if (value.match(/rgb/i)) {
        results.push([value.toLowerCase(), `CSS Variable (${name})`]);
      }
    }
  });

  return results;
}

function extractCSSRuleColors(css: string): [string, string][] {
  const results: [string, string][] = [];

  // Extract color properties from CSS rules
  const ruleRegex = /([.#][^{]+)\{([^}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(css)) !== null) {
    const selector = match[1].trim();
    const declaration = match[2];

    // Look for color properties
    const colorProps = [
      "color",
      "background-color",
      "background",
      "border-color",
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color",
    ];

    colorProps.forEach((prop) => {
      const propRegex = new RegExp(`${prop}\\s*:\\s*([^;]+)`, "gi");
      let propMatch;

      while ((propMatch = propRegex.exec(declaration)) !== null) {
        const value = propMatch[1].trim();

        // Check if it's a color value
        if (value.match(/#([0-9a-f]{3,8})\b/i)) {
          const colorMatch = value.match(/#([0-9a-f]{3,8})\b/i);
          if (colorMatch) {
            let context = "Unknown";

            // Try to determine context from selector
            if (selector.includes("btn") || selector.includes("button")) {
              context = "Button";
            } else if (
              selector.includes("link") ||
              selector.match(/^a[.#\s]/)
            ) {
              context = "Link";
            } else if (selector.match(/h[1-6]/)) {
              context = "Heading";
            } else if (selector.includes("header")) {
              context = "Header";
            } else if (selector.includes("footer")) {
              context = "Footer";
            } else if (selector.includes("nav")) {
              context = "Navigation";
            } else if (selector.includes("card")) {
              context = "Card";
            } else if (
              selector.includes("input") ||
              selector.includes("form")
            ) {
              context = "Form Element";
            } else if (selector.includes("body")) {
              context = "Body";
            } else {
              // Use the selector as context
              context =
                selector.length > 30
                  ? selector.substring(0, 30) + "..."
                  : selector;
            }

            results.push([colorMatch[0].toLowerCase(), `${context} (${prop})`]);
          }
        } else if (value.match(/rgb/i)) {
          results.push([value.toLowerCase(), `${selector} (${prop})`]);
        }
      }
    });
  }

  return results;
}

function addColorToMap(
  color: string,
  context: string,
  colorMap: Map<string, Set<string>>
) {
  if (!colorMap.has(color)) {
    colorMap.set(color, new Set());
  }
  colorMap.get(color)?.add(context);
}

function detectFrameworks(html: string): string[] {
  const frameworks: string[] = [];
  const detectedTech = new Set<string>();

  // --------------- Frontend Frameworks/Libraries ---------------

  // jQuery detection (more specific checks)
  if (
    html.includes("jquery.min.js") ||
    html.includes("jquery.js") ||
    html.includes("jQuery(") ||
    html.includes("$.ajax") ||
    html.match(/jquery[.-](\d+\.\d+\.\d+)/)
  ) {
    detectedTech.add("jQuery");
  }

  // Bootstrap detection (improved)
  if (
    html.includes("bootstrap.min.css") ||
    html.includes("bootstrap.bundle.min.js") ||
    html.includes("bootstrap.min.js") ||
    html.match(
      /class="[^"]*\b(btn-primary|navbar-expand|container-fluid|row|col-(xs|sm|md|lg|xl)-\d+)\b/
    ) ||
    html.match(/data-bs-(toggle|target|dismiss)=/)
  ) {
    detectedTech.add("Bootstrap");
  }

  // React detection (improved)
  if (
    html.includes("react.production.min.js") ||
    html.includes("react.development.js") ||
    html.includes("react-dom.production.min.js") ||
    html.includes("_reactRootContainer") ||
    html.includes("__REACT_DEVTOOLS_GLOBAL_HOOK__") ||
    html.includes("data-reactroot") ||
    html.includes("data-reactid")
  ) {
    detectedTech.add("React");
  }

  // Next.js detection
  if (
    html.includes("__NEXT_DATA__") ||
    html.includes("next/dist") ||
    html.includes("/_next/")
  ) {
    detectedTech.add("Next.js");
    detectedTech.add("React"); // Next.js is based on React
  }

  // Vue detection (improved)
  if (
    html.includes("vue.min.js") ||
    html.includes("vue.js") ||
    html.includes("vue@") ||
    html.includes("__vue__") ||
    html.match(/data-v-[a-f0-9]{8}/) ||
    html.match(/<[^>]+v-[a-z]+/) || // Vue directives like v-if, v-for
    html.includes("Vue.createApp") ||
    html.includes("new Vue")
  ) {
    detectedTech.add("Vue.js");
  }

  // Nuxt.js detection
  if (html.includes("/__nuxt/") || html.includes("window.__NUXT__")) {
    detectedTech.add("Nuxt.js");
    detectedTech.add("Vue.js"); // Nuxt.js is based on Vue
  }

  // Angular detection (improved)
  if (
    html.includes("angular.min.js") ||
    html.includes("angular.js") ||
    html.match(/ng-[a-z]+="[^"]*"/) ||
    html.match(/ng-[a-z]+='[^']*'/) ||
    html.match(/\[\[angular\.[a-z]+/) ||
    html.includes("ng-app") ||
    html.includes("ng-controller") ||
    html.includes("ng-model") ||
    html.match(/_ng(content|host)/)
  ) {
    detectedTech.add("Angular");
  }

  // Angular 2+ specific detection
  if (
    (html.includes("zone.js") &&
      html.includes("polyfills") &&
      (html.includes("angular") || html.includes("ng-"))) ||
    html.match(/_ngcontent-[a-z0-9-]+/) ||
    html.match(/_nghost-[a-z0-9-]+/)
  ) {
    detectedTech.add("Angular (Modern)");
  }

  // Tailwind CSS detection (improved)
  if (
    html.includes("tailwind.css") ||
    html.includes("tailwindcss") ||
    html.match(
      /class="[^"]*\b(flex|grid|space-x-\d|text-\w+-\d+|bg-\w+-\d+|p-\d+|m-\d+|rounded-[a-z]+)\b[^"]*"/i
    ) ||
    html.match(
      /class='[^']*\b(flex|grid|space-x-\d|text-\w+-\d+|bg-\w+-\d+|p-\d+|m-\d+|rounded-[a-z]+)\b[^']*'/i
    )
  ) {
    detectedTech.add("Tailwind CSS");
  }

  // Svelte detection
  if (
    html.includes("svelte") ||
    html.match(/svelte-[a-z0-9]{6}/) ||
    html.match(/svelte-[a-z0-9]{6}-[a-z]+/)
  ) {
    detectedTech.add("Svelte");
  }

  // Materialize CSS detection
  if (
    html.includes("materialize.min.css") ||
    html.includes("materialize.css") ||
    html.includes("materialize.min.js") ||
    html.match(/class="[^"]*\b(waves-effect|card-panel|material-icons)\b/)
  ) {
    detectedTech.add("Materialize CSS");
  }

  // Foundation detection (improved)
  if (
    html.includes("foundation.min.css") ||
    html.includes("foundation.css") ||
    html.includes("foundation.min.js") ||
    (html.match(
      /class="[^"]*\b(top-bar|button|callout|small-\d+|medium-\d+|large-\d+)\b[^"]*"/i
    ) &&
      html.includes("foundation"))
  ) {
    detectedTech.add("Foundation");
  }

  // Bulma detection (improved)
  if (
    html.includes("bulma.min.css") ||
    html.includes("bulma.css") ||
    (html.match(
      /class="[^"]*\b(columns|column|notification|box|button is-|navbar|hero is-|section)\b[^"]*"/i
    ) &&
      !html.includes("bootstrap")) // Avoid false positives
  ) {
    detectedTech.add("Bulma");
  }

  // --------------- CMS & Server-side Frameworks ---------------

  // WordPress detection
  if (
    html.includes("wp-content") ||
    html.includes("wp-includes") ||
    html.includes("wp-json") ||
    html.includes("wp-admin") ||
    html.includes("wp-embed.min.js")
  ) {
    detectedTech.add("WordPress");
  }

  // Django detection
  if (
    html.includes("csrfmiddlewaretoken") ||
    html.includes("__django") ||
    html.includes("django") ||
    html.includes("DJANGO_SETTINGS_MODULE") ||
    html.includes("Powered by Django")
  ) {
    detectedTech.add("Django");
  }

  // Ruby on Rails detection
  if (
    (html.includes("csrf-param") && html.includes("csrf-token")) ||
    html.includes("data-turbolinks") ||
    html.includes("rails-ujs") ||
    html.includes("/assets/rails") ||
    html.includes("ruby on rails")
  ) {
    detectedTech.add("Ruby on Rails");
  }

  // Laravel detection
  if (
    html.includes("Laravel") ||
    html.includes("laravel") ||
    (html.includes("csrf-token") &&
      (html.includes("app.js") || html.includes("app.css"))) ||
    html.includes("x-csrf-token") ||
    html.includes("Powered by Laravel")
  ) {
    detectedTech.add("Laravel");
  }

  // Express.js/Node.js detection
  if (
    html.includes("Express") ||
    html.includes("express") ||
    html.includes("node_modules") ||
    html.includes("Powered by Express") ||
    html.includes("X-Powered-By: Express")
  ) {
    detectedTech.add("Express.js/Node.js");
  }

  // ASP.NET detection
  if (
    html.includes("__VIEWSTATE") ||
    html.includes("__EVENTVALIDATION") ||
    html.includes("asp.net") ||
    html.includes("ASP.NET") ||
    html.includes("microsoft.aspnetcore")
  ) {
    detectedTech.add("ASP.NET");
  }

  // PHP detection
  if (
    html.includes("Powered by PHP") ||
    html.includes(".php") ||
    html.includes("PHP/") ||
    html.includes("PHPSESSID")
  ) {
    detectedTech.add("PHP");
  }

  // --------------- E-commerce Platforms ---------------

  // Shopify detection
  if (
    html.includes("Shopify.") ||
    html.includes("shopify") ||
    html.includes("/cdn.shopify.com/") ||
    html.includes("myshopify.com")
  ) {
    detectedTech.add("Shopify");
  }

  // WooCommerce detection
  if (
    html.includes("woocommerce") ||
    html.includes("WooCommerce") ||
    html.includes("wc-") ||
    (html.includes("cart-contents") && html.includes("wp-content"))
  ) {
    detectedTech.add("WooCommerce");
    detectedTech.add("WordPress"); // WooCommerce is a WordPress plugin
  }

  // Magento detection
  if (
    html.includes("Magento") ||
    html.includes("magento") ||
    html.includes("Mage.") ||
    html.includes("/skin/frontend/")
  ) {
    detectedTech.add("Magento");
  }

  // --------------- Javascript Utility Libraries ---------------

  // Lodash detection
  if (
    html.includes("lodash.min.js") ||
    html.includes("lodash.js") ||
    html.includes("_.debounce") ||
    html.includes("_.throttle")
  ) {
    detectedTech.add("Lodash");
  }

  // Moment.js detection
  if (
    html.includes("moment.min.js") ||
    html.includes("moment.js") ||
    html.includes("moment-with-locales")
  ) {
    detectedTech.add("Moment.js");
  }

  // Axios detection
  if (
    html.includes("axios.min.js") ||
    html.includes("axios.js") ||
    html.includes("axios.get(") ||
    html.includes("axios.post(")
  ) {
    detectedTech.add("Axios");
  }

  // Convert Set to array and return
  return Array.from(detectedTech);
}

function extractImages(root: any, baseUrl: string): string[] {
  const images = new Set<string>();
  const imgElements = root.querySelectorAll("img");

  // Helper function to normalize URLs
  const normalizeUrl = (src: string): string => {
    // Handle data URLs and absolute URLs
    if (src.startsWith("data:") || src.startsWith("http")) {
      return src;
    }

    try {
      const url = new URL(baseUrl);

      // Handle absolute paths that start with /
      if (src.startsWith("/")) {
        return `${url.origin}${src}`;
      }

      // Handle relative paths
      // Make sure we don't duplicate slashes if the baseUrl already ends with /
      const base = url.href.endsWith("/") ? url.href.slice(0, -1) : url.href;
      return `${base}/${src.startsWith("./") ? src.substring(2) : src}`;
    } catch (e) {
      // If URL parsing fails, return as is
      return src;
    }
  };

  // Process img tags
  imgElements.forEach((img: any) => {
    let src = img.getAttribute("src");
    if (src) {
      images.add(normalizeUrl(src));
    }

    // Also check data-src for lazy-loaded images
    const dataSrc = img.getAttribute("data-src");
    if (dataSrc) {
      images.add(normalizeUrl(dataSrc));
    }
  });

  // Check for background images in inline styles
  const elementsWithStyle = root.querySelectorAll("[style]");
  elementsWithStyle.forEach((el: any) => {
    const style = el.getAttribute("style");
    if (style && style.includes("background")) {
      // Match url() patterns with various quotes
      const matches = style.match(/url\(['"]?([^'"()]+)['"]?\)/gi);
      if (matches) {
        matches.forEach((match: string) => {
          const urlMatch = match.match(/url\(['"]?([^'"()]+)['"]?\)/i);
          if (urlMatch && urlMatch[1]) {
            images.add(normalizeUrl(urlMatch[1]));
          }
        });
      }
    }
  });

  // Check for background images in CSS stylesheets
  const styleElements = root.querySelectorAll("style");
  styleElements.forEach((style: any) => {
    const cssText = style.text || style.innerHTML;
    if (cssText) {
      const matches = cssText.match(/url\(['"]?([^'"()]+)['"]?\)/gi);
      if (matches) {
        matches.forEach((match: string) => {
          const urlMatch = match.match(/url\(['"]?([^'"()]+)['"]?\)/i);
          if (urlMatch && urlMatch[1]) {
            // Ignore data URLs and font files
            const src = urlMatch[1];
            if (
              !src.startsWith("data:") &&
              !src.endsWith(".woff") &&
              !src.endsWith(".woff2") &&
              !src.endsWith(".ttf") &&
              !src.endsWith(".eot")
            ) {
              images.add(normalizeUrl(src));
            }
          }
        });
      }
    }
  });

  return Array.from(images);
}
