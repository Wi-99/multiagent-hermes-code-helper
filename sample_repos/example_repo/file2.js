/** 示例仓库 — 含可检测缺陷的 JavaScript 代码 */

const password = "admin123"; // 硬编码密码

function renderUserInput(userInput) {
  const container = document.getElementById("app");
  container.innerHTML = userInput; // XSS 风险
}

function runUnsafe(code) {
  return eval(code); // 不安全 eval
}

module.exports = { renderUserInput, runUnsafe };
