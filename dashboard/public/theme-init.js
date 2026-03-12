// Blocking: set data-theme before first paint to prevent flash.
// This file MUST be loaded as an external script (not inline) because
// OpenClaw's control-ui CSP sets "script-src 'self'" which blocks inline scripts.
(function(){var t=localStorage.getItem('rc-theme');if(t)document.documentElement.setAttribute('data-theme',t)})();
