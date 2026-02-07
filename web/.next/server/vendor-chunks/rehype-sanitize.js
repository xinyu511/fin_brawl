"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/rehype-sanitize";
exports.ids = ["vendor-chunks/rehype-sanitize"];
exports.modules = {

/***/ "(ssr)/./node_modules/rehype-sanitize/index.js":
/*!***********************************************!*\
  !*** ./node_modules/rehype-sanitize/index.js ***!
  \***********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ rehypeSanitize),\n/* harmony export */   defaultSchema: () => (/* reexport safe */ hast_util_sanitize__WEBPACK_IMPORTED_MODULE_0__.defaultSchema)\n/* harmony export */ });\n/* harmony import */ var hast_util_sanitize__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! hast-util-sanitize */ \"(ssr)/./node_modules/hast-util-sanitize/lib/schema.js\");\n/* harmony import */ var hast_util_sanitize__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! hast-util-sanitize */ \"(ssr)/./node_modules/hast-util-sanitize/lib/index.js\");\n/**\n * @typedef {import('hast').Root} Root\n *\n * @typedef {import('hast-util-sanitize').Schema} Options\n *   The sanitation schema defines how and if nodes and properties should be cleaned.\n *   See `hast-util-sanitize`.\n *   The default schema is exported as `defaultSchema`.\n */\n\n\n\n/**\n * Plugin to sanitize HTML.\n *\n * @type {import('unified').Plugin<[Options?] | Array<void>, Root, Root>}\n */\nfunction rehypeSanitize(options = hast_util_sanitize__WEBPACK_IMPORTED_MODULE_0__.defaultSchema) {\n  // @ts-expect-error: assume input `root` matches output root.\n  return (tree) => (0,hast_util_sanitize__WEBPACK_IMPORTED_MODULE_1__.sanitize)(tree, options)\n}\n\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvcmVoeXBlLXNhbml0aXplL2luZGV4LmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTtBQUNBLGFBQWEscUJBQXFCO0FBQ2xDO0FBQ0EsYUFBYSxxQ0FBcUM7QUFDbEQ7QUFDQTtBQUNBO0FBQ0E7O0FBRThFOztBQUU5RTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDZSxrQ0FBa0MsNkRBQWE7QUFDOUQ7QUFDQSxtQkFBbUIsNERBQWdCO0FBQ25DOztBQUVnRCIsInNvdXJjZXMiOlsid2VicGFjazovL2J1ZGdldC1hZ2VudC8uL25vZGVfbW9kdWxlcy9yZWh5cGUtc2FuaXRpemUvaW5kZXguanM/NWQ5ZiJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEB0eXBlZGVmIHtpbXBvcnQoJ2hhc3QnKS5Sb290fSBSb290XG4gKlxuICogQHR5cGVkZWYge2ltcG9ydCgnaGFzdC11dGlsLXNhbml0aXplJykuU2NoZW1hfSBPcHRpb25zXG4gKiAgIFRoZSBzYW5pdGF0aW9uIHNjaGVtYSBkZWZpbmVzIGhvdyBhbmQgaWYgbm9kZXMgYW5kIHByb3BlcnRpZXMgc2hvdWxkIGJlIGNsZWFuZWQuXG4gKiAgIFNlZSBgaGFzdC11dGlsLXNhbml0aXplYC5cbiAqICAgVGhlIGRlZmF1bHQgc2NoZW1hIGlzIGV4cG9ydGVkIGFzIGBkZWZhdWx0U2NoZW1hYC5cbiAqL1xuXG5pbXBvcnQge3Nhbml0aXplIGFzIGhhc3RVdGlsU2FuaXRpemUsIGRlZmF1bHRTY2hlbWF9IGZyb20gJ2hhc3QtdXRpbC1zYW5pdGl6ZSdcblxuLyoqXG4gKiBQbHVnaW4gdG8gc2FuaXRpemUgSFRNTC5cbiAqXG4gKiBAdHlwZSB7aW1wb3J0KCd1bmlmaWVkJykuUGx1Z2luPFtPcHRpb25zP10gfCBBcnJheTx2b2lkPiwgUm9vdCwgUm9vdD59XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJlaHlwZVNhbml0aXplKG9wdGlvbnMgPSBkZWZhdWx0U2NoZW1hKSB7XG4gIC8vIEB0cy1leHBlY3QtZXJyb3I6IGFzc3VtZSBpbnB1dCBgcm9vdGAgbWF0Y2hlcyBvdXRwdXQgcm9vdC5cbiAgcmV0dXJuICh0cmVlKSA9PiBoYXN0VXRpbFNhbml0aXplKHRyZWUsIG9wdGlvbnMpXG59XG5cbmV4cG9ydCB7ZGVmYXVsdFNjaGVtYX0gZnJvbSAnaGFzdC11dGlsLXNhbml0aXplJ1xuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/rehype-sanitize/index.js\n");

/***/ })

};
;