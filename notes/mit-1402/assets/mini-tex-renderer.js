(() => {
  "use strict";
  const commandMap = {
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε",
    theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ",
    sigma: "σ", phi: "φ", psi: "ψ", omega: "ω", varepsilon: "ε", Delta: "Δ", Omega: "Ω", Pi: "Π",
    sum: "∑", prod: "∏", approx: "≈", equiv: "≡", cdots: "⋯",
    to: "→", longrightarrow: "→", Rightarrow: "⇒", rightarrow: "→",
    leftarrow: "←", Longleftrightarrow: "⇔", Leftrightarrow: "⇔",
    uparrow: "↑", downarrow: "↓", times: "×", cdot: "·",
    ge: "≥", le: "≤", neq: "≠", gt: ">", lt: "<", infty: "∞",
    ln: "ln", partial: "∂", textbf: ""
  };
  const escapeHtml = value => value.replace(/[&<>]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;"})[ch]);

  function readGroup(source, start) {
    while (source[start] === " ") start++;
    if (source[start] !== "{") return { value: source[start] || "", end: start + 1 };
    let depth = 1, index = start + 1;
    for (; index < source.length && depth; index++) {
      if (source[index] === "{") depth++;
      else if (source[index] === "}") depth--;
    }
    return { value: source.slice(start + 1, index - 1), end: index };
  }

  function renderTex(source) {
    let html = "", index = 0;
    while (index < source.length) {
      const char = source[index];
      if (char === "\\") {
        let end = index + 1;
        if (/[A-Za-z]/.test(source[end] || "")) {
          while (/[A-Za-z]/.test(source[end] || "")) end++;
        } else {
          end++;
        }
        const command = source.slice(index + 1, end);
        index = end;
        if (command === "frac") {
          const numerator = readGroup(source, index);
          const denominator = readGroup(source, numerator.end);
          html += `<span class="tex-frac"><span class="tex-num">${renderTex(numerator.value)}</span><span class="tex-den">${renderTex(denominator.value)}</span></span>`;
          index = denominator.end;
        } else if (command === "text" || command === "mathrm") {
          const group = readGroup(source, index);
          html += `<span class="tex-roman">${escapeHtml(group.value.replace(/\\ /g, " "))}</span>`;
          index = group.end;
        } else if (command === "sqrt") {
          const group = readGroup(source, index);
          html += `<span class="tex-sqrt">√<span>${renderTex(group.value)}</span></span>`;
          index = group.end;
        } else if (command === "boxed") {
          const group = readGroup(source, index);
          html += `<span class="tex-boxed">${renderTex(group.value)}</span>`;
          index = group.end;
        } else if (command === "underbrace") {
          const group = readGroup(source, index);
          html += `<span class="tex-underbrace">${renderTex(group.value)}</span>`;
          index = group.end;
        } else if (command === "tilde") {
          const atom = readGroup(source, index);
          html += `<span class="tex-tilde">${renderTex(atom.value)}</span>`;
          index = atom.end;
        } else if (command === "hat" || command === "widehat") {
          const atom = readGroup(source, index);
          html += `<span class="tex-hat">${renderTex(atom.value)}</span>`;
          index = atom.end;
        } else if (command === "bar") {
          const atom = readGroup(source, index);
          html += `<span class="tex-bar">${renderTex(atom.value)}</span>`;
          index = atom.end;
        } else if (command === "$" || command === "%" || command === "#") {
          html += command;
        } else if (command === "," || command === ";" || command === ":" || command === " " || command === "quad" || command === "qquad") {
          html += command === "qquad" ? "<span class=\"tex-space-wide\"></span>" : command === "quad" ? "<span class=\"tex-space\"></span>" : "&thinsp;";
        } else if (command === "displaystyle" || command === "left" || command === "right") {
          // Presentation-only TeX command; the surrounding block supplies display styling.
        } else {
          html += escapeHtml(commandMap[command] ?? command);
        }
      } else if (char === "^" || char === "_") {
        const atom = readGroup(source, index + 1);
        html += char === "^" ? `<sup>${renderTex(atom.value)}</sup>` : `<sub>${renderTex(atom.value)}</sub>`;
        index = atom.end;
      } else if (char === "{") {
        const group = readGroup(source, index);
        html += renderTex(group.value);
        index = group.end;
      } else {
        html += escapeHtml(char);
        index++;
      }
    }
    return html;
  }

  function formula(text, display = false) {
    const clean = text.trim().replace(/^\\[([]/, "").replace(/\\[)\]]$/, "").trim();
    const span = document.createElement("span");
    span.className = display ? "tex-rendered tex-display" : "tex-rendered";
    span.setAttribute("role", "math");
    span.setAttribute("aria-label", clean);
    span.innerHTML = renderTex(clean);
    return span;
  }

  function replaceDelimitedText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (/\\\([\s\S]+?\\\)/.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const parts = node.nodeValue.split(/(\\\([\s\S]+?\\\))/g);
      const fragment = document.createDocumentFragment();
      parts.forEach(part => {
        if (part.startsWith("\\(") && part.endsWith("\\)")) fragment.appendChild(formula(part));
        else if (part) fragment.appendChild(document.createTextNode(part));
      });
      node.replaceWith(fragment);
    });
  }

  function renderAll() {
    document.querySelectorAll(".md-math-line").forEach(node => node.replaceChildren(formula(node.textContent, true)));
    document.querySelectorAll(".md-math-row").forEach(node => {
      const label = node.querySelector(":scope > span");
      const labelText = label ? label.textContent : "";
      const tex = node.textContent.slice(labelText.length).trim();
      node.replaceChildren();
      if (labelText) {
        const labelNode = document.createElement("span");
        labelNode.className = "md-math-label";
        labelNode.textContent = labelText;
        node.appendChild(labelNode);
      }
      node.appendChild(formula(tex));
    });
    document.querySelectorAll(".symbol-cell, .md-flow, .tex-inline").forEach(replaceDelimitedText);
    document.documentElement.classList.add("tex-ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderAll);
  else renderAll();
})();
