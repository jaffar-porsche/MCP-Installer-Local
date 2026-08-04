export default `
<!doctype html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Application Access Request</title>
  <script type="module" crossorigin>true              &&(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\\"modulepreload\\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
}());

var componentsJs$1 = {exports: {}};

var componentsJs = componentsJs$1.exports;

var hasRequiredComponentsJs;

function requireComponentsJs () {
	if (hasRequiredComponentsJs) return componentsJs$1.exports;
	hasRequiredComponentsJs = 1;
	(function (module, exports) {
		!function(e,t){module.exports=t();}("undefined"!=typeof self?self:componentsJs,(()=>(()=>{var e={d:(t,n)=>{for(var o in n)e.o(n,o)&&!e.o(t,o)&&Object.defineProperty(t,o,{enumerable:true,get:n[o]});},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t),r:e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:true});}},t={};e.r(t),e.d(t,{componentsReady:()=>i,load:()=>r});const n="porscheDesignSystem";function o(){return document[n]||(document[n]={}),document[n]}function s({script:e,version:t,prefix:s}){const r=function(e){const t=o(),{[e]:n}=t;if(!n){let n=()=>{};const o=new Promise((e=>n=e));t[e]={isInjected:false,isReady:()=>o,readyResolve:n,prefixes:[],registerCustomElements:null};}return t[e]}(t),{isInjected:c,prefixes:i=[],registerCustomElements:d}=r,[m]=Object.entries(o()).filter((([e,n])=>e!==t&&"object"==typeof n&&n.prefixes.includes(s)));if(m)throw new Error(\`[Porsche Design System v\${t}] prefix '\${s}' is already registered with version '\${m[0]}' of the Porsche Design System. Please use a different one.\\nTake a look at document.\${n} for more details.\`);c||(function(e){const t=document.createElement("script");t.src=e,t.setAttribute("crossorigin",""),document.body.appendChild(t);}(e),r.isInjected=true),i.includes(s)||(i.push(s),d&&d(s));}const r=(e={})=>{const t="PORSCHE_DESIGN_SYSTEM_CDN";window[t]=e.cdn||window[t]||(window.location.origin.match(/\\.cn$/)?"cn":"auto");const n="porscheDesignSystem";document[n]||(document[n]={}),document[n].cdn={url:"https://cdn.ui.porsche."+("cn"===window[t]?"cn":"com"),prefixes:[]},s({version:"3.29.0",script:document[n].cdn.url+"/porsche-design-system/components/porsche-design-system.v3.29.0.c747d4e24a1fc76fef40.js",prefix:e.prefix||""});},c={loading:0,interactive:1,complete:2},i=(e=document.body,t="complete")=>{let n;const o=new Promise((e=>n=e)),s=()=>{m().then((()=>p(e,n)));};if(d(t))s();else {const e="readystatechange",n=()=>{d(t)&&(document.removeEventListener(e,n),s());};document.addEventListener(e,n);}return o},d=e=>c[document.readyState]>=c[e],m=()=>{if(document.porscheDesignSystem?.["3.29.0"]?.isReady)return document.porscheDesignSystem["3.29.0"].isReady();let e;const t=new Promise((t=>e=t)),n={set(t,n,o){return "3.29.0"===n&&o.isReady().then(e),Reflect.set(...arguments)}};return document.porscheDesignSystem=new Proxy(document.porscheDesignSystem||{},n),t},p=(e,t)=>{const n=u(e);Promise.all(n).then((e=>t(e.length))).catch((e=>console.error("[Porsche Design System]",e)));},u=e=>{const t=[],n=[e];for(;n.length>0;){const e=n.pop();e.nodeType===Node.ELEMENT_NODE&&(a(e)&&t.push(e.componentOnReady()),n.push(...Array.from(e.children)));}return t},f=/^(.*-)?P-(.*)$/,a=e=>f.test(e.tagName)&&"function"==typeof e.componentOnReady;return t})())); 
	} (componentsJs$1));
	return componentsJs$1.exports;
}

requireComponentsJs();

const e="porscheDesignSystem";function t(){return document[e]||(document[e]={}),document[e]}function n({script:n,version:s,prefix:o}){const c=function(e){const n=t(),{[e]:s}=n;if(!s){let t=()=>{};const s=new Promise((e=>t=e));n[e]={isInjected:false,isReady:()=>s,readyResolve:t,prefixes:[],registerCustomElements:null};}return n[e]}(s),{isInjected:r,prefixes:i=[],registerCustomElements:d}=c,[m]=Object.entries(t()).filter((([e,t])=>e!==s&&"object"==typeof t&&t.prefixes.includes(o)));if(m)throw new Error(\`[Porsche Design System v\${s}] prefix '\${o}' is already registered with version '\${m[0]}' of the Porsche Design System. Please use a different one.\\nTake a look at document.\${e} for more details.\`);r||(function(e){const t=document.createElement("script");t.src=e,t.setAttribute("crossorigin",""),document.body.appendChild(t);}(n),c.isInjected=true),i.includes(o)||(i.push(o),d&&d(o));}const s=(e={})=>{const t="PORSCHE_DESIGN_SYSTEM_CDN";window[t]=e.cdn||window[t]||(window.location.origin.match(/\\.cn$/)?"cn":"auto");const s="porscheDesignSystem";document[s]||(document[s]={}),document[s].cdn={url:"https://cdn.ui.porsche."+("cn"===window[t]?"cn":"com"),prefixes:[]},n({version:"3.29.0",script:document[s].cdn.url+"/porsche-design-system/components/porsche-design-system.v3.29.0.c747d4e24a1fc76fef40.js",prefix:e.prefix||""});};

s();</script>
  <style rel="stylesheet" crossorigin>.container {
  display: grid;
  grid-template-columns:
    1fr
    minmax(0, 1140px)
    1fr;
  row-gap: 1rem; /* Adds vertical spacing between grid rows */
}

.content {
  grid-column: 2;
  padding: 2rem;

  display: grid;
  row-gap: 1rem;
}</style>
</head>

<body>
  <div id="app" class="container">
    <div class="content">
      <div>
        <p-heading>Application Access Request</p-heading>
      </div>
      <div>
        <p-inline-notification heading="An application is requesting access"
          type="info" dismiss-button="false"></p-inline-notification>
      </div>
      <div>
        <p-table>
          <p-table-head>
            <p-table-head-row>
              <p-table-head-cell>Name</p-table-head-cell>
              <p-table-head-cell>Value</p-table-head-cell>
            </p-table-head-row>
          </p-table-head>
          <p-table-body>
            <p-table-row>
              <p-table-cell>Application Name</p-table-cell>
              <p-table-cell><code>{{ params.client.client_name }}</code></p-table-cell>
            </p-table-row>
            <p-table-row>
              <p-table-cell>Application Website</p-table-cell>
              <p-table-cell><code>{{ params.client.client_uri }}</code></p-table-cell>
            </p-table-row>
            <p-table-row>
              <p-table-cell>Client ID</p-table-cell>
              <p-table-cell><code>{{ params.client.client_id }}</code></p-table-cell>
            </p-table-row>
            <p-table-row>
              <p-table-cell>Redirect URI</p-table-cell>
              <p-table-cell><code>{{ params.redirect_uri }}</code></p-table-cell>
            </p-table-row>
          </p-table-body>
        </p-table>
      </div>
      <div>
        <form method="post" action="/consent">
          <input type="hidden" name="client_id" value="{{ params.client_id }}" />
          <input type="hidden" name="redirect_uri" value="{{ params.redirect_uri }}" />
          <input type="hidden" name="response_type" value="code" />
          <input type="hidden" name="code_challenge" value="{{ params.code_challenge }}" />
          <input type="hidden" name="code_challenge_method" value="S256" />
          <input type="hidden" name="scope" value="{{ params.scope }}" />
          <input type="hidden" name="state" value="{{ params.state }}" />
          <p-button-group>
            <p-button type="submit" variant="primary" name="consent_action" value="approve">Approve</p-button>
            <p-button type="submit" variant="secondary" name="consent_action" value="deny">Deny</p-button>
          </p-button-group>
        </form>
      </div>
    </div>
  </div>
</body>
</html>
` as const;
