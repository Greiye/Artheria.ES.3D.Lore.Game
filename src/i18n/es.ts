// B23: Spanish (Spain, tú) for the UI. Keys are the English strings exactly as the game writes them. Names of people
// and places stay as they are. Lore, books, NPC talk and player text are not here (not translated yet).
export const ES: Record<string, string> = {
  // Title and main menu
  'Begin': 'Empezar', 'New game': 'Partida nueva', 'Profiles': 'Perfiles', 'Extras': 'Extras', 'Options': 'Opciones', 'Main menu': 'Menú principal',
  'Continue': 'Continuar', 'Language': 'Idioma',
  'For fullscreen with no address bar: tap Share': 'Para pantalla completa sin barra de direcciones: toca Compartir',
  ', then': ', luego', 'Add to Home Screen': 'Añadir a pantalla de inicio', ', and play from the new icon.': ', y juega desde el icono nuevo.',
  'Hide this tip': 'Ocultar este consejo',
  // Gate
  'Temporary Exit - Mind the dust': 'Salida provisional - Cuidado con el polvo', 'Leave the area?': '¿Salir de la zona?',
  'This will retire you. Your bag and the hour are saved; next time you begin back at the glade.': 'Esto te retira. Tu bolsa y la hora se guardan; la próxima vez empiezas otra vez en el claro.',
  'Or walk on up the coach road, west into the mountains.': 'O sigue por el camino de diligencias, al oeste, hacia las montañas.',
  'Walk on to the Amethyst Peak gates': 'Sigue hasta las puertas del Pico Amatista', 'Yes, retire': 'Sí, retirarme', 'No, stay': 'No, me quedo',
  // Phone
  'Turn your phone sideways': 'Gira el móvil en horizontal', 'Artheria plays in landscape.': 'Artheria se juega en horizontal.',
  "If it doesn't turn, swipe down from the top-right corner and switch off Rotation Lock.": 'Si no gira, desliza hacia abajo desde la esquina superior derecha y desactiva el bloqueo de rotación.',
  'Turn it for me': 'Gíralo por mí', 'Play upright anyway': 'Jugar en vertical igualmente',
  '⟳ Turn your phone upright to scroll the pages': '⟳ Pon el móvil en vertical para pasar las páginas',
  // HUD
  '✒ Saved': '✒ Guardado', 'Pointer lock unavailable here: hold the left mouse button and drag to look.': 'Aquí no se puede bloquear el puntero: mantén el botón izquierdo y arrastra para mirar.',
  'Click to continue': 'Haz clic para continuar',
  // Pause menu
  'Journal': 'Diario', 'Resume': 'Reanudar', 'Gameplay': 'Juego', 'Graphics': 'Gráficos', 'Sound': 'Sonido', 'Controls': 'Controles',
  'Casebook': 'Cuaderno de casos', 'Map': 'Mapa', 'Bag': 'Bolsa', 'Phrasebook': 'Libro de frases', 'Skills book': 'Libro de habilidades',
  'Recipe book': 'Recetario', 'Who you are': 'Quién eres', 'Play with friends': 'Jugar con amigos', 'Quit to Main Menu': 'Salir al menú principal',
  'Settings are saved in this browser.': 'Los ajustes se guardan en este navegador.',
  // Gameplay settings
  'Camera': 'Cámara', 'Overhead (Dark Cloud 2 style)': 'Cenital (estilo Dark Cloud 2)', 'Over the shoulder': 'Sobre el hombro', 'First person': 'Primera persona',
  'Look sensitivity': 'Sensibilidad de la vista', 'Invert Y': 'Invertir Y', 'Always run (Caps Lock)': 'Correr siempre (Bloq Mayús)',
  'Characters': 'Personajes', '3D bodies, drawn heads': 'Cuerpos 3D, cabezas dibujadas', 'Pixel sprites': 'Sprites de píxeles',
  'Vibration (controller rumble, phone buzz)': 'Vibración (mando y móvil)', 'Camera follows your walk': 'La cámara sigue tu paso',
  'Touch and controller': 'Táctil y mando', 'Always': 'Siempre', 'Off': 'No',
  'Auto-lean (aiming at a wall edge leans out; crouched behind low cover, you peek over)': 'Asomarse solo (al apuntar junto a una esquina te asomas; agachado tras una cobertura baja, miras por encima)',
  'See through walls (the camera stays out; walls in the way open up)': 'Ver a través de paredes (la cámara se queda fuera; las paredes que estorban se abren)',
  'Quiet companion (Natalie keeps her thoughts to herself)': 'Compañera callada (Natalie se guarda lo que piensa)',
  'Comfort': 'Comodidad', 'Text size': 'Tamaño del texto', 'Reading speed': 'Velocidad de lectura',
  'Left-handed (touch: move on the right, buttons on the left)': 'Zurdo (táctil: moverse a la derecha, botones a la izquierda)',
  'Touch button size': 'Tamaño de los botones táctiles', 'Your works': 'Tus obras', 'Your works · send to Mike': 'Tus obras · enviar a Mike',
  'Your hero': 'Tu héroe', 'Who you are (optional)': 'Quién eres (opcional)', 'Character forge': 'Forja de personaje', 'Weapon forge': 'Forja de armas',
  'Sketchbook': 'Cuaderno de bocetos', 'Casebook (J)': 'Cuaderno de casos (J)', 'Map (M)': 'Mapa (M)',
  // Graphics
  'Preset': 'Preajuste', 'Low power (iPhone)': 'Bajo consumo (iPhone)', 'Low': 'Bajo', 'Medium': 'Medio', 'High': 'Alto',
  'Render scale': 'Escala de render', 'Shadows': 'Sombras', 'Post effects (glow)': 'Posefectos (brillo)',
  'Ink outlines (characters, buildings and props)': 'Contornos de tinta (personajes, edificios y objetos)', 'Fog distance': 'Distancia de niebla',
  'FPS cap': 'Límite de FPS', 'Auto quality (eases off when the frame rate drops)': 'Calidad automática (baja cuando caen los FPS)', 'Field of view': 'Campo de visión',
  // Sound
  'Master': 'General', 'Mute master': 'Silenciar todo', 'Music': 'Música', 'Mute music': 'Silenciar música', 'SFX': 'Efectos', 'Mute SFX': 'Silenciar efectos',
  'Dialogue': 'Diálogo', 'Mute dialogue': 'Silenciar diálogo',
  // Controls
  'Left thumb': 'Pulgar izquierdo', 'Move (small push walks, full push runs)': 'Moverse (poco empuje camina, a fondo corre)', 'Right thumb': 'Pulgar derecho',
  'Drag to look': 'Arrastra para mirar', 'Buttons': 'Botones', 'Jump · Sneak · Sprint (hold) · View · Use · − / + camera · ☰ menu': 'Saltar · Sigilo · Esprintar (mantener) · Vista · Usar · − / + cámara · ☰ menú',
  'Book': 'Libro', 'Swipe or tap a page edge · ✕ to close': 'Desliza o toca el borde de la página · ✕ para cerrar', 'Move (runs by default)': 'Moverse (corre por defecto)',
  'Mouse': 'Ratón', 'Look': 'Mirar', 'Walk (hold)': 'Caminar (mantener)', 'Caps Lock': 'Bloq Mayús', 'Toggle always-run': 'Correr siempre sí/no',
  'Sprint (hold)': 'Esprintar (mantener)', 'Space': 'Espacio', 'Jump': 'Saltar', 'Sneak / crouch': 'Sigilo / agacharse', 'Use · read · talk': 'Usar · leer · hablar',
  'Close book': 'Cerrar libro', 'Pause menu': 'Menú de pausa', 'Camera: first person / shoulder / overhead': 'Cámara: primera persona / hombro / cenital',
  'Wheel': 'Rueda', 'Camera in / out': 'Acercar / alejar cámara', 'Swap shoulder (or weapon)': 'Cambiar de hombro (o de arma)', 'Torch': 'Antorcha',
  'Crossbow · hands · sword': 'Ballesta · manos · espada', 'Click': 'Clic', 'Fire · swing the sword': 'Disparar · blandir la espada',
  // Lore editor
  'Add to the campaign': 'Añadir a la campaña', 'Write lore': 'Escribir historia', 'Your name': 'Tu nombre', 'Title': 'Título', 'Tags': 'Etiquetas',
  'comma-separated': 'separadas por comas', 'Entry': 'Texto', 'Markdown: **bold**, *italic*, lists, images': 'Markdown: **negrita**, *cursiva*, listas, imágenes',
  'Cancel': 'Cancelar', 'Download .md': 'Descargar .md', 'Publish to GitHub': 'Publicar en GitHub', 'GitHub publish settings': 'Ajustes de publicación en GitHub',
  'Repo owner': 'Dueño del repo', 'Repo name': 'Nombre del repo', 'Branch': 'Rama', 'Personal access token': 'Token de acceso personal',
  'stays only in this browser': 'solo se queda en este navegador', 'Save publish settings': 'Guardar ajustes de publicación',
  'e.g. The Old Mill': 'p. ej. El Molino Viejo', 'character, place, rumor': 'personaje, lugar, rumor',
  'Write anything: a character, a place, a poem, a rumor...': 'Escribe lo que quieras: un personaje, un lugar, un poema, un rumor...',
  'Create a fine-grained token at github.com → Settings → Developer settings → Personal access tokens, scoped to this one repo, permission "Contents: Read and write".':
    'Crea un token detallado en github.com → Settings → Developer settings → Personal access tokens, solo para este repo, con permiso "Contents: Read and write".',
  // Things you can do (the E prompt)
  'Read': 'Leer', 'Pick up bolt': 'Recoger el virote', 'Pick up rock': 'Coger la piedra', 'Talk to Natalie': 'Hablar con Natalie', 'Look closer': 'Mirar de cerca', 'Climb out': 'Salir', 'Gather rocks': 'Coger piedras', 'Follow the blue light': 'Seguir la luz azul',
  'Buy arms from the smith': 'Comprar armas al herrero', 'Care for your gear': 'Cuidar tu equipo', 'Change your look': 'Cambiar tu aspecto',
  'Practise a real skill': 'Practicar una habilidad real', 'Read the death tally': 'Leer la cuenta de caídos', 'Read the plaque': 'Leer la placa',
  'Read the wiki': 'Leer la wiki', 'Ride the wagon': 'Subir a la carreta', 'Sit by the fire': 'Sentarse junto al fuego',
  'Sketch at the writing desk': 'Dibujar en el escritorio', 'Take the practice sword': 'Coger la espada de prácticas',
  'Trade with the Shopkeeper': 'Comerciar con el Tendero', "Watch the Projectionist's reels": 'Ver las bobinas del Proyeccionista', 'Watch the reels': 'Ver las bobinas',
  "Look at the survivors' wall": 'Mirar el muro de los supervivientes', 'Go down the stairs': 'Bajar las escaleras', 'Step through the portal': 'Cruzar el portal',
  'Step back through the portal': 'Volver por el portal', 'Train at the dojo': 'Entrenar en el dojo', "Flip a coin at Tam's table": 'Lanzar una moneda en la mesa de Tam',
  'Forge your crossbow': 'Forjar tu ballesta', 'Climb into the knight frame': 'Subir al armazón de caballero', 'Talk to Candor (archery)': 'Hablar con Candor (tiro con arco)',
  'Talk to Candor (lesson on)': 'Hablar con Candor (lección en curso)', 'Fly a sky run': 'Volar una carrera aérea',
  // The people (as the prompt and lists name them)
  'the cook (Spanish)': 'la cocinera (en español)', 'the weaver (Spanish)': 'la tejedora (en español)', 'the muleteer (Spanish)': 'el arriero (en español)',
  'the tea seller (Japanese)': 'la vendedora de té (en japonés)', 'the potter (Japanese)': 'la alfarera (en japonés)', 'the fisher (Japanese)': 'el pescador (en japonés)',
  'the fruit seller (Tagalog)': 'la frutera (en tagalo)', 'the fisherman (Tagalog)': 'el pescador (en tagalo)', 'Lola, the grandmother (Tagalog)': 'Lola, la abuela (en tagalo)', 'the child (Tagalog)': 'el niño (en tagalo)',
  'the Shopkeeper': 'el Tendero', 'the smith': 'el herrero', 'the Projectionist': 'el Proyeccionista', 'the wagoner': 'el carretero',
  // Common buttons and words in panels
  'Close': 'Cerrar', 'Back': 'Volver', 'Save': 'Guardar', 'Done': 'Hecho', 'Yes': 'Sí', 'No': 'No', 'OK': 'Vale', 'Next': 'Siguiente', 'Previous': 'Anterior',
  'Leave': 'Salir', 'Buy': 'Comprar', 'Sell': 'Vender', 'Delete': 'Borrar', 'Share': 'Compartir', 'Send': 'Enviar', 'Export': 'Exportar', 'Import': 'Importar',
  'Clear': 'Borrar', 'Undo': 'Deshacer', 'Redo': 'Rehacer', 'Random': 'Al azar', 'Reset': 'Restablecer', 'Talk again': 'Hablar otra vez', 'Pick a reply': 'Elegir respuesta',
  'Write my reply': 'Escribir mi respuesta', 'Every line you got through is in your phrasebook (Journal → Phrasebook).': 'Cada frase que superaste está en tu libro de frases (Diario → Libro de frases).',
  'Lines you heard, in the words they were said. Write what you think each one means; nobody will tell you.': 'Frases que oíste, tal como se dijeron. Escribe lo que crees que significa cada una; nadie te lo dirá.',
  'What I think it means': 'Lo que creo que significa', 'you said': 'dijiste', 'Journal · Phrasebook': 'Diario · Libro de frases', 'Hear it again': 'Escuchar otra vez',
  'Spanish · the caravan': 'Español · la caravana', 'Japanese · the tea house': 'Japonés · la casa de té', 'Tagalog · the market': 'Tagalo · el mercado', 'Leave the table': 'Dejar la mesa', 'Heads or Tails': 'Cara o cruz',
};

// "{x}" matches any text; a known string inside it is translated too.
export const ES_PATTERNS: [string, string][] = [
  ['Talk to {who}', 'Hablar con {who}'],
  ['Look at "{what}"', 'Mirar «{what}»'],
  ['Sleep until {when}', 'Dormir hasta {when}'],
  ['Rent a bed until {when}', 'Alquilar una cama hasta {when}'],
  ['Enter the {place}', 'Entrar en {place}'],
  ['Fly a sky run ({n} won)', 'Volar una carrera aérea ({n} ganadas)'],
  ['{what} (after your first day)', '{what} (después de tu primer día)'],
  ['Met {who}: {n} of {total}', 'Conociste a {who}: {n} de {total}'],
  ['{n} of {total}', '{n} de {total}'],
];
