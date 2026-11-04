// The game's static DOM: title and menus, HUD, pause menu, Journal pages, settings. No interpolation: main.ts
// fills and wires it after it's attached.
export const SHELL_HTML = `
  <div id="title" class="screen">
    <nav class="menu-list" aria-label="Main menu">
      <button id="begin" class="menu-item">Begin</button>
      <button id="newGame" class="menu-item hidden">New game</button>
      <button id="openProfiles" class="menu-item">Profiles</button>
      <button id="openExtras" class="menu-item">Extras</button>
      <button id="openSettingsTitle" class="menu-item">Options</button>
    </nav>
    <p id="saveNote" class="fine hidden"></p>
    <p id="homeTip" class="hidden">For fullscreen with no address bar: tap Share <b>⬆</b>, then <b>Add to Home Screen</b>, and play from the new icon.<button id="homeTipClose" aria-label="Hide this tip">✕</button></p>
    <span id="versionLabel" class="menu-version"></span>
  </div>
  <div id="padStatus" aria-live="polite"></div>
  <div id="versionNote"></div>
  <div id="gateConfirm" class="screen hidden">
    <div class="card narrow">
      <div class="eyebrow">Temporary Exit - Mind the dust</div>
      <h1>Leave the area?</h1>
      <p>This will retire you. Your bag and the hour are saved; next time you begin back at the glade.</p>
      <button id="gateYes" class="primary">Yes, retire</button>
      <button id="gateNo" class="secondary">No, stay</button>
    </div>
  </div>
  <div id="vignette"></div>
  <div id="sleepFade"></div>
  <div id="rotateAsk" role="dialog" aria-label="Turn your phone sideways">
    <div class="ra-phone" aria-hidden="true"></div>
    <p>Turn your phone sideways</p>
    <span>Artheria plays in landscape.</span>
    <span id="rotateIos" class="hidden">If it doesn't turn, swipe down from the top-right corner and switch off Rotation Lock.</span>
    <button id="rotateTurn" class="primary hidden">Turn it for me</button>
    <button id="rotateOk" class="secondary">Play upright anyway</button>
  </div>
  <div id="readHint">⟳ Turn your phone upright to scroll the pages</div>
  <div id="hud" class="hidden">
    <div id="crosshair"></div>
    <div id="steady" class="hidden"></div>
    <div id="prompt" class="hidden"><kbd>E</kbd> — <span id="promptVerb">Read</span></div>
    <div id="toast" class="hidden"></div>
    <div id="quick" class="hidden"></div>
    <div id="delveHp" class="hidden sr-only" aria-live="polite"></div>
    <div id="hurtEdge" aria-hidden="true"></div>
    <div id="ammo" class="hidden"><span id="ammoText"></span><div id="reloadBar" class="hidden"><i class="zone"></i><i class="fill"></i></div></div>
    <div id="autosaved" aria-live="polite">✒ Saved</div>
    <div id="coach" class="hidden" aria-live="polite"></div>
    <div id="nolock" class="hidden">Pointer lock unavailable here: hold the left mouse button and drag to look.</div>
  </div>
  <div id="pause" class="screen hidden">
    <nav class="pause-side side-panel" aria-label="Pause menu">
      <h1>Journal</h1>
      <button id="resume" class="pause-item">Resume</button>
      <button class="pause-item" data-group="gameplay">Gameplay</button>
      <button class="pause-item" data-group="graphics">Graphics</button>
      <button class="pause-item" data-group="sound">Sound</button>
      <button class="pause-item" data-group="controls">Controls</button>
      <span class="pause-rule" aria-hidden="true"></span>
      <button id="pgCasebook" class="pause-item pause-page">Casebook</button>
      <button id="pgMap" class="pause-item pause-page">Map</button>
      <button id="pgBag" class="pause-item pause-page">Bag</button>
      <button id="pgPhrases" class="pause-item pause-page">Phrasebook</button>
      <button id="pgSkills" class="pause-item pause-page">Skills book</button>
      <button id="pgRecipes" class="pause-item pause-page">Recipe book</button>
      <button id="pgSelf" class="pause-item pause-page">Who you are</button>
      <button id="pgFriends" class="pause-item pause-page">Play with friends</button>
      <button id="quitToMenu" class="pause-item">Quit to Main Menu</button>
      <p class="fine">Settings are saved in this browser.</p>
    </nav>
    <section id="gameplaySettings" class="pause-panel side-panel hidden" data-panel="gameplay">
      <h2>Gameplay</h2>
      <label class="field">Camera <select id="viewSel"><option value="overhead">Overhead (Dark Cloud 2 style)</option><option value="shoulder">Over the shoulder</option><option value="first">First person</option></select></label>
      <label>Look sensitivity <output id="sensOut"></output><input id="sens" type="range" min="0.2" max="3" step="0.05"></label>
      <label class="check"><input id="invert" type="checkbox"> Invert Y</label>
      <label class="check"><input id="always" type="checkbox"> Always run (Caps Lock)</label>
      <label class="field">Characters <select id="charsSel"><option value="hybrid">3D bodies, drawn heads</option><option value="sprite">Pixel sprites</option></select></label>
      <label class="check"><input id="haptics" type="checkbox"> Vibration (controller rumble, phone buzz)</label>
      <label class="field">Camera follows your walk <select id="cameraLead"><option value="auto">Touch and controller</option><option value="on">Always</option><option value="off">Off</option></select></label>
      <label class="check"><input id="autoLean" type="checkbox"> Auto-lean (aiming at a wall edge leans out; crouched behind low cover, you peek over)</label>
      <label class="check"><input id="seeThrough" type="checkbox"> See through walls (the camera stays out; walls in the way open up)</label>
      <label class="check"><input id="companionQuiet" type="checkbox"> Quiet companion (Natalie keeps her thoughts to herself)</label>
      <h4>Comfort</h4>
      <label>Text size <output id="textSizeOut"></output><input id="textSize" type="range" min="85" max="150" step="5"></label>
      <label>Reading speed <output id="readSpeedOut"></output><input id="readSpeed" type="range" min="0.5" max="2" step="0.25"></label>
      <label class="check"><input id="lefty" type="checkbox"> Left-handed (touch: move on the right, buttons on the left)</label>
      <label>Touch button size <output id="buttonSizeOut"></output><input id="buttonSize" type="range" min="75" max="150" step="5"></label>
      <h4>Your hero</h4>
      <button id="editCharacter" class="secondary">Who you are (optional)</button>
      <button id="openCharacterForge" class="secondary">Character forge</button>
      <button id="openWeaponForge" class="secondary">Weapon forge</button>
      <button id="openSketchbook" class="secondary">Sketchbook</button>
      <button id="openCasebook" class="secondary">Casebook (J)</button>
      <button id="openMap" class="secondary">Map (M)</button>
    </section>
    <section id="graphicsSettings" class="pause-panel side-panel hidden" data-panel="graphics">
      <h2>Graphics</h2>
      <label class="field">Preset
        <select id="preset"><option value="lowpower">Low power (iPhone)</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
      </label>
      <label>Render scale <output id="renderScaleOut"></output><input id="renderScale" type="range" min="40" max="100" step="5"></label>
      <label class="check"><input id="shadows" type="checkbox"> Shadows</label>
      <label class="check"><input id="postFx" type="checkbox"> Post effects (glow)</label>
      <label class="check"><input id="inkLines" type="checkbox"> Ink outlines (characters, buildings and props)</label>
      <label>Fog distance <output id="fogOut"></output><input id="fogDistance" type="range" min="20" max="120" step="5"></label>
      <label class="field">FPS cap
        <select id="fpsCap"><option value="30">30</option><option value="60">60</option><option value="0">∞</option></select>
      </label>
      <label class="check"><input id="autoQuality" type="checkbox"> Auto quality (eases off when the frame rate drops) <output id="autoQualityOut"></output></label>
      <label>Field of view <output id="fovOut"></output><input id="fov" type="range" min="60" max="100" step="1"></label>
    </section>
    <section id="audioSettings" class="pause-panel side-panel hidden" data-panel="sound">
      <h2>Sound</h2>
      <label>Master <output id="audioMasterOut"></output><input id="audioMaster" type="range" min="0" max="100" step="5"></label>
      <label class="check"><input id="muteMaster" type="checkbox"> Mute master</label>
      <label>Music <output id="audioMusicOut"></output><input id="audioMusic" type="range" min="0" max="100" step="5"></label>
      <label class="check"><input id="muteMusic" type="checkbox"> Mute music</label>
      <label>SFX <output id="audioSfxOut"></output><input id="audioSfx" type="range" min="0" max="100" step="5"></label>
      <label class="check"><input id="muteSfx" type="checkbox"> Mute SFX</label>
      <label>Dialogue <output id="audioDialogueOut"></output><input id="audioDialogue" type="range" min="0" max="100" step="5"></label>
      <label class="check"><input id="muteDialogue" type="checkbox"> Mute dialogue</label>
    </section>
    <section id="controlsMap" class="pause-panel side-panel hidden" data-panel="controls">
      <h2>Controls</h2>
      <table class="keys only-touch">
        <tr><td>Left thumb</td><td>Move (small push walks, full push runs)</td></tr>
        <tr><td>Right thumb</td><td>Drag to look</td></tr>
        <tr><td>Buttons</td><td>Jump · Sneak · Sprint (hold) · View · Use · − / + camera · ☰ menu</td></tr>
        <tr><td>Book</td><td>Swipe or tap a page edge · ✕ to close</td></tr>
      </table>
      <table class="keys only-mouse">
        <tr><td>W A S D</td><td>Move (runs by default)</td><td>Mouse</td><td>Look</td></tr>
        <tr><td>Shift</td><td>Walk (hold)</td><td>Caps Lock</td><td>Toggle always-run</td></tr>
        <tr><td>Alt</td><td>Sprint (hold)</td><td>Space</td><td>Jump</td></tr>
        <tr><td>C</td><td>Sneak / crouch</td><td>E</td><td>Use · read · talk</td></tr>
        <tr><td>Tab</td><td>Close book</td><td>Esc</td><td>Pause menu</td></tr>
        <tr><td>F</td><td>Camera: first person / shoulder / overhead</td><td>Wheel</td><td>Camera in / out</td></tr>
        <tr><td>Q</td><td>Swap shoulder (or weapon)</td><td>T</td><td>Torch</td></tr>
        <tr><td>1 · 2 · 3</td><td>Crossbow · hands · sword</td><td>Click</td><td>Fire · swing the sword</td></tr>
      </table>
      <div class="padmap" data-padmap></div>
      <div id="keyBinds"></div>
    </section>
  </div>
  <div id="relock" class="screen hidden"><button class="primary" id="relockBtn">Click to continue</button></div>
  <div id="editor" class="screen hidden">
    <div class="card editcard">
      <div class="eyebrow">Add to the campaign</div>
      <h1>Write lore</h1>
      <label class="field">Your name<input id="eAuthor" type="text" maxlength="60" placeholder="Your name"></label>
      <label class="field">Title<input id="eTitle" type="text" maxlength="80" placeholder="e.g. The Old Mill"></label>
      <label class="field">Tags <span class="hint">comma-separated</span><input id="eTags" type="text" placeholder="character, place, rumor"></label>
      <label class="field">Entry <span class="hint">Markdown: **bold**, *italic*, lists, images</span>
        <textarea id="eBody" rows="8" placeholder="Write anything: a character, a place, a poem, a rumor..."></textarea>
      </label>
      <p id="eMsg" class="fine"></p>
      <div class="row">
        <button id="eCancel">Cancel</button>
        <button id="eDownload">Download .md</button>
        <button id="ePublish" class="primary">Publish to GitHub</button>
      </div>
      <details id="eSettings">
        <summary>GitHub publish settings</summary>
        <label class="field">Repo owner<input id="ghOwner" type="text" placeholder="e.g. Greiye"></label>
        <label class="field">Repo name<input id="ghRepo" type="text" placeholder="e.g. Artheria.ES.3D.Lore.Game"></label>
        <label class="field">Branch<input id="ghBranch" type="text" placeholder="main"></label>
        <label class="field">Personal access token <span class="hint">stays only in this browser</span><input id="ghToken" type="password" placeholder="github_pat_..."></label>
        <p class="fine">Create a fine-grained token at github.com → Settings → Developer settings → Personal access tokens, scoped to this one repo, permission "Contents: Read and write".</p>
        <button id="ghSave">Save publish settings</button>
      </details>
    </div>
  </div>`;
