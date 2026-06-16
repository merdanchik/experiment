# experiment — CLAUDE.md

Форк [cullenwebber/three-particles](https://github.com/cullenwebber/three-particles).  
Живёт на: **https://merdanchik.github.io/experiment/**  
Репозиторий: **https://github.com/merdanchik/experiment**  
Деплой: GitHub Actions (`.github/workflows/deploy.yml`) — автоматически при пуше в `main`.

---

## Стек

| | |
|---|---|
| Three.js | 0.182.0 |
| Vite | 7.x |
| Tailwind | 4.x |
| vite-plugin-glsl | импорт `.glsl` как строк |
| maath | easing/damping для камеры |

---

## Архитектура

```
src/
├── core/
│   ├── Three.js          — главный цикл, timeScale, RAF, slow-mo, pause
│   └── WebGLContext.js   — синглтон-рендерер (паттерн singleton через static instance)
├── meshes/
│   ├── Particles.js      — GPU-частицы через GPUComputationRenderer (512×512 = 262144 частиц)
│   ├── Background.js     — шейдерный градиент, крепится к камере
│   └── Tracery.js        — маркеры с линиями (ОТКЛЮЧЁН, файл оставлен)
├── scenes/
│   └── Scene.js          — композиция сцены, async #init()
├── postprocessing/
│   ├── Composer.js       — EffectComposer обёртка
│   └── MotionBlur.js     — 2-pass velocity motion blur
├── utils/
│   └── CameraRig.js      — мышь → плавное движение камеры (maath easing)
└── shaders/
    ├── simulation/fragment.glsl  — GPU-симуляция позиций (curl noise)
    ├── particles/                — рендер частиц (освещение, тени, сфера из point sprite)
    ├── shadow/                   — depth pass для самозатенения
    ├── background/               — градиент фона
    ├── motion/                   — velocity pass + blur pass
    └── utils/curl.glsl           — 4D Simplex → curl noise
```

### WebGLContext — синглтон
`new WebGLContext()` всегда возвращает один и тот же экземпляр.  
`init()` помечен `async`, но внутри нет `await` — выполняется синхронно.

### Scene — async constructor
`Scene.#init()` — `async`. `#setupComposer()` выполняется после `await #addObjects()`,  
то есть уже в следующем микротаске после `new Scene()`.  
`this.particles` устанавливается внутри `#addObjects()` синхронно — доступен сразу.

### GPUComputationRenderer
- Текстура позиций: 512×512, RGBA Float32, каналы = (X, Y, Z, life)
- `createTexture()` → `DataTexture` с `Float32Array`, `FloatType`
- Зависимости переменной (texturePosition) добавляются через `setVariableDependencies`
- Дополнительные uniforms добавляются через `Object.assign(positionVariable.material.uniforms, {...})`
- `compute()` вызывается каждый кадр в `Particles.update()`

---

## Что сделано (текущее состояние)

### Удалено из оригинала
- `Tracery` (маркеры, линии, координатные лейблы) — убран из `Scene.js`, файл оставлен
- Надпись "Never Stop Starting™" — убрана из `index.html`

### Изменено
- Фон: `colorTop/colorBottom = 0x000000` (чёрный) в `Background.js`
- Тень частиц: `shadowColor = 0x000000` в `Particles.js`
- `vite.config.js`: `base: "/experiment/"` для GitHub Pages

### Добавлено
- **3 кнопки** внизу по центру (`index.html` + `style.css`):
  - **Motion Blur** — включает/выключает `motionBlur.pass.enabled` и `renderVelocity`
  - **Slow Mo** — блокирует `targetTimeScale = 0.15` (при этом pointerup не сбрасывает)
  - **Pause** — флаг `paused` в `Three.js`, текст меняется Play/Pause
- **GitHub Actions** деплой (`.github/workflows/deploy.yml`)

### Архитектура управления состоянием кнопок
```
main.js (click) → Three.setX() → Scene.setX() → Particles/MotionBlur.setX()
```
Все кнопки используют `e.stopPropagation()` чтобы не триггерить pointerdown slow-mo на контейнере.

---

## Провальная попытка: силуэт человека

Предпринято 4 попытки добавить форму силуэта — все провалились с результатом "сфера".

### Попытка 1 — Canvas + DataTexture
- Нарисовать силуэт на `<canvas>`, прочитать пиксели через `getImageData()`
- Заполнить `DataTexture` (через `gpuCompute.createTexture()`) координатами точек силуэта
- `canvas.getImageData()` возвращал пустые данные (все alpha=0) в этом Vite/модульном контексте
- Результат: все target-позиции = (0,0,0) → все частицы стягивались к центру → плотная сфера

### Попытка 2 — Аналитическая JS геометрия + DataTexture
- Заменить canvas на математические проверки попадания в части тела (JS)
- Та же DataTexture через `gpuCompute.createTexture()`
- Та же плотная сфера. Предположительно: `DataTexture` не загружалась на GPU корректно

### Попытка 3 — Процедурный GLSL (без текстур)
- Перенести всю геометрию силуэта в шейдер: функция `silhouetteTarget(uv)` с хэш-функциями
- `h(uv) = fract(sin(dot(uv, vec2(127.1, 311.7))) * 43758.5453)` для случайного выбора части тела
- Убрать `textureTarget` полностью, добавить `uRadius` uniform
- Та же сфера. Возможная причина: `uAttractStrength` не достигал шейдера, или осцилляция из-за нормализованного attraction вектора

### Попытка 4 — Lerp-based attraction + console.log
- Заменить `mix(flow, attract, strength)` на `position += toTarget * 0.12 * strength * delta` (lerp, нет overshoot)
- Respawn тоже на силуэт при `uAttractStrength > 0.5`
- Добавить `console.log` для диагностики
- Откатились не дождавшись результата

### Нерешённые вопросы по силуэту
1. Доходит ли `uAttractStrength` до шейдера? (Нужна проверка через консоль браузера)
2. Компилируется ли шейдер без ошибок? (GPUComputationRenderer логирует ошибки в console.error)
3. Возможно ли вообще изменить uniform через `Object.assign` после создания ShaderMaterial?
   - Судя по исходнику GPUComputationRenderer: да, `variable.material.uniforms` — обычный объект

### Потенциальный правильный подход (не реализован)
Самый надёжный вариант — изменить **`defaultPositionTexture`** (не добавлять новый uniform):
- Когда силуэт включается: заполнить `defaultPositionTexture` точками силуэта + `needsUpdate = true`
- Когда выключается: восстановить сферические позиции
- Это работает через уже проверенный механизм respawn, без дополнительных uniforms
- Ускорить эффект: временно поднять `uDieSpeed` чтобы частицы быстрее умирали и респавнились

---

## Ключевые правила при работе с этим проектом

### GPU / Three.js
- `WebGLContext` — синглтон, не создавать новый рендерер
- `Scene.#init()` async — `this.particles` доступен, `this.composer` может не быть в первом микротаске
- `GPUComputationRenderer.createTexture()` создаёт `Float32Array` + `FloatType` DataTexture
- Дополнительные uniforms симуляции: `Object.assign(positionVariable.material.uniforms, {...})`
- Шейдеры компилируются в браузере (не в Vite) — ошибки GLSL только в runtime console
- `vite-plugin-glsl` только инлайнит `#include` — синтаксис проверяется WebGL драйвером

### Кнопки / UI
- Кнопки находятся ВНЕ `#app` контейнера (`fixed` позиционирование в `body`)
- Всегда `e.stopPropagation()` на click чтобы не триггерить slow-mo pointerdown
- Стили в `src/style.css`: список ID в двух селекторах (base + `[data-active="true"]`)
- `data-active="true/false"` управляет стилем через CSS attribute selector

### Деплой
- `npm run build` → `dist/` → GitHub Actions загружает как Pages artifact
- `vite.config.js` base ДОЛЖЕН быть `/experiment/` иначе ассеты не найдутся
- После пуша ждать ~2 мин до обновления сайта
