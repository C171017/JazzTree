/** Lightweight, dependency-free localisation for the static app. */

export const LOCALES = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'zh-CN', label: '简体中文', short: '中' },
];

let activeLocale = 'en';

export function setLocale(locale) {
  activeLocale = LOCALES.some((item) => item.id === locale) ? locale : 'en';
  document.documentElement.lang = activeLocale;
}

export function locale() {
  return activeLocale;
}

const zh = {
  'meta.title': 'JazzTree — 爵士乐流派谱系与聆听指南',
  'meta.description': '一份涵盖 39 种爵士乐流派、它们的传承与反叛关系，以及约 350 张必听唱片的可视化指南。',
  'brand.tag': '谱系与聆听指南',
  'skip': '跳至主要内容',
  'views.label': '视图',
  'view.graph': '谱系',
  'view.graph.title': '以时间为轴的影响关系图',
  'view.timeline': '时间线',
  'view.timeline.title': '每种流派一条时间带，不显示连线',
  'view.grid': '流派',
  'view.grid.title': '可搜索的全部流派卡片',
  'view.paths': '路径',
  'view.paths.title': '三条精选聆听路线',
  'service.label': '首选流媒体服务',
  'service.title': '选择每张唱片卡片上优先显示的服务',
  'gentle': '轻松模式',
  'gentle.title': '隐藏最具挑战的唱片（难度 4 和 5）',
  'gentle.on': '轻松模式已开启 — 高难度唱片已隐藏。',
  'gentle.off': '轻松模式已关闭。',
  'theme': '切换深色与浅色主题',
  'language': '语言',
  'locale.switchEnglish': '英文',
  'locale.name.en': '英语',
  'locale.name.zhCN': '简体中文',
  'narrow.opened': '已打开卡片视图 — 可从标签页进入谱系图；建议使用宽屏或双指缩放。',
  'footer.stats': '{genres} 种流派 · {edges} 条影响关系 · {albums} 张唱片。',
  'footer.sources.before': '所有内容均为人工撰写并注明来源；资料来源及未核实项目见 ',
  'footer.sources.middle': '，判断与取舍见 ',
  'footer.sources.after': '。',
  'footer.streaming': '流媒体按钮指向搜索结果，而非直接专辑链接 — 专辑 ID 无法由元数据推导，猜测 ID 可能会指向错误唱片。流派边界本就存在争议；每个档案都会说明争议所在。',
  'footer.inline': '已加载内置备用数据。',
  'grid.search.placeholder': '搜索流派、音乐人、厂牌、城市…',
  'grid.search.label': '搜索流派',
  'grid.allFamilies': '全部家族',
  'grid.sort.label': '流派排序',
  'grid.sort.era': '年代',
  'grid.sort.name': '按名称',
  'grid.sort.family': '家族',
  'grid.sort.difficulty': '由易到难',
  'grid.graphCta': '查看谱系图 →',
  'grid.graphCta.title': '谱系图横向较宽：双指缩放，拖动平移',
  'grid.title': '全部三十九种流派',
  'grid.lede': '每种流派一张卡片。打开卡片可了解它的声音、代表人物、争议，以及九到十张值得聆听的唱片。',
  'grid.wideNote': ' 横向宽幅设计 — 双指缩放，拖动平移。',
  'grid.count': '{shown} / {total}',
  'grid.empty': '没有匹配“{query}”的结果。',
  'grid.start': '从这里开始：{artist} — {title}',
  'grid.records': '{count} 张唱片',
  'grid.matches': '有 {count} 种流派匹配 {query}。',
  'timeline.title': '每种流派，各占一行',
  'timeline.lede': '同一份数据，去掉影响关系连线。长条表示流派的活跃时期，内部深色区块表示巅峰年代。',
  'timeline.aria': '从 {start} 年至今的 {count} 种爵士乐流派时间线，按家族分组。',
  'paths.title': '三条聆听路线',
  'paths.lede': '按顺序聆听，并用一句话解释每张唱片为何承接上一张。听完即可勾选 — 进度会保存在此浏览器中。',
  'paths.choose': '选择聆听路线',
  'paths.selected': '已选择“{name}”。',
  'paths.heard': '已听 {done} / {total}',
  'paths.progress': '“{name}”的聆听进度',
  'paths.clear': '清除进度',
  'paths.heardIt': '已听',
  'paths.startWith': ' — 建议从《{track}》开始',
  'graph.aria': '爵士乐流派谱系图。横轴为时间，每个胶囊代表一种流派及其活跃时期。',
  'graph.hint': '拖动平移 · 滚轮或双指缩放 · 点击流派查看档案，点击连线查看传承内容',
  'graph.influenceDetail': '影响详情',
  'graph.inherited': '传承要素',
  'graph.aspectOnly': '仅显示传承了“{aspect}”的影响关系',
  'graph.all': '全部',
  'graph.clearAspect': '清除要素筛选',
  'graph.year': '年份',
  'graph.yearAria': '显示该年份时的谱系图',
  'graph.reset': '重置',
  'graph.showAll': '再次显示全部流派',
  'graph.how': '如何阅读',
  'graph.families': '家族：',
  'graph.legendNote': '线条粗细代表影响强度。胶囊底部的实色区块表示流派的巅峰年代。',
  'graph.zoomIn': '放大',
  'graph.zoomOut': '缩小',
  'graph.fit': '完整显示谱系图',
  'graph.resetView': '重置视图',
  'graph.edgeAria': '{from} 影响了 {to}：{type}',
  'graph.filtered': '当前仅显示传承了 {aspects} 的影响关系。',
  'graph.now': '现在',
  'graph.close': '关闭',
  'graph.strength': '影响强度：{strength}',
  'graph.openHinge': '打开收录此唱片的流派档案',
  'graph.hearHinge': '聆听转折点',
  'panel.aria': '流派档案',
  'panel.close': '关闭流派档案',
  'panel.profileAria': '{name} — 流派档案',
  'panel.opened': '已打开 {name} 的流派档案。',
  'panel.alsoCalled': '又称：{names}',
  'panel.listenFor': '聆听重点',
  'panel.how': '音乐特征',
  'panel.figures': '代表人物',
  'panel.labels': '厂牌',
  'panel.contested': '争议',
  'panel.hear': '推荐聆听',
  'panel.gateway': '入门',
  'panel.gateway.note': '最适合从这一张开始',
  'panel.core': '核心',
  'panel.core.note': '最能代表该流派的唱片',
  'panel.deep': '深入',
  'panel.deep.note': '入门之后继续探索',
  'panel.alsoFiled': '也归于此',
  'panel.alsoFiled.note': '主要归属相邻流派的唱片',
  'panel.gentleHidden': '轻松模式已开启 — 此流派中较具挑战的唱片已隐藏。',
  'album.recordedReleased': '录制/发行 {year}',
  'album.recorded': '录制 {recorded} · 发行 {released}',
  'album.startWith': '从《{track}》开始',
  'album.filedUnder': '归于：{genres}',
  'album.listenFor': '聆听重点',
  'album.note': '注：{note}',
  'album.difficulty': '难度 {difficulty}/5 — {label}',
  'album.confidence': '{confidence} 可信度',
  'album.weak': '此条目的佐证弱于大多数条目；详见 research/notes.md',
  'service.listen': '聆听 {artist} — {title}',
  'service.spotify': '在 Spotify 搜索',
  'service.appleMusic': '在 Apple Music 搜索',
  'service.netease': '在网易云音乐搜索',
  'service.name.spotify': 'Spotify',
  'service.name.appleMusic': 'Apple Music',
  'service.name.netease': '网易云音乐',
  'strength.strong': '强',
  'strength.moderate': '中等',
  'strength.weak': '弱',
  'decade.format': '{decade}年代',
  'era.present': '至今',
  'difficulty.1': '轻松易听',
  'difficulty.2': '容易入门',
  'difficulty.3': '需要投入',
  'difficulty.4': '较具挑战',
  'difficulty.5': '非常具挑战',
  'confidence.medium': '中等',
  'confidence.low': '较低',
};

export function t(key, vars = {}) {
  let value;
  if (activeLocale === 'zh-CN') {
    value = zh[key] ?? `【缺少中文：${key}】`;
  } else {
    value = EN[key] ?? key;
  }
  return String(value).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
}

const EN = {
  'meta.title': 'JazzTree — a lineage and listening guide to jazz',
  'meta.description': 'A visual guide to 39 jazz genres, how they descend from and react against each other, and roughly 350 records to actually listen to.',
  'brand.tag': 'lineage & listening guide', 'skip': 'Skip to content', 'views.label': 'Views',
  'view.graph': 'Lineage', 'view.graph.title': 'The time-anchored influence graph',
  'view.timeline': 'Timeline', 'view.timeline.title': 'Every genre as one bar, no edges',
  'view.grid': 'Genres', 'view.grid.title': 'All genres as searchable cards',
  'view.paths': 'Paths', 'view.paths.title': 'Three curated listening routes',
  'service.label': 'Preferred streaming service', 'service.title': 'Which service appears first on every album card',
  'gentle': 'Gentle path', 'gentle.title': 'Gentle path: hide the most demanding records (difficulty 4 and 5)',
  'gentle.on': 'Gentle path on — demanding records hidden.', 'gentle.off': 'Gentle path off.',
  'theme': 'Switch between the dark and light theme', 'language': 'Language',
  'locale.switchEnglish': 'EN', 'locale.name.en': 'English', 'locale.name.zhCN': 'Simplified Chinese',
  'narrow.opened': 'Opened in card view — the lineage graph is available from the tabs and needs a wider screen or pinch-zoom.',
  'footer.stats': '{genres} genres · {edges} influence edges · {albums} records. ',
  'footer.sources.before': 'Everything here is hand-authored and sourced; see ', 'footer.sources.middle': ' for sources and a list of what could not be verified, ', 'footer.sources.after': ' for the judgment calls.',
  'footer.streaming': 'Streaming buttons are searches, not direct album links — album IDs cannot be derived from metadata and guessed ones point at the wrong records. Genre boundaries are contested; each profile says where and by whom.',
  'footer.inline': 'Embedded backup data loaded.',
  'grid.search.placeholder': 'Search genres, figures, labels, cities…', 'grid.search.label': 'Search genres', 'grid.allFamilies': 'All families', 'grid.sort.label': 'Sort genres',
  'grid.sort.era': 'Era', 'grid.sort.name': 'A–Z', 'grid.sort.family': 'Family', 'grid.sort.difficulty': 'Easiest first',
  'grid.graphCta': 'View the lineage graph →', 'grid.graphCta.title': 'The graph is wide: pinch to zoom and drag to pan',
  'grid.title': 'All thirty-nine genres', 'grid.lede': 'Every genre as a card. Open one for what it sounds like, who made it, what is disputed about it, and nine or ten records to hear.', 'grid.wideNote': ' Wide by design — pinch to zoom, drag to pan.',
  'grid.count': '{shown} of {total}', 'grid.empty': 'Nothing matches “{query}”.', 'grid.start': 'Start: {artist} — {title}', 'grid.records': '{count} records', 'grid.matches': '{count} genres match {query}.',
  'timeline.title': 'Every genre, one line each', 'timeline.lede': "The same data with the influence edges stripped out. Bar length is the genre's active span; the darker block inside it marks the peak years.", 'timeline.aria': 'Timeline of {count} jazz genres from {start} to the present, grouped by family.',
  'paths.title': 'Three routes through', 'paths.lede': 'Ordered listening, with a sentence explaining why each record follows the one before it. Tick them off as you go — your progress is stored in this browser.', 'paths.choose': 'Choose a listening path', 'paths.selected': '{name} selected.', 'paths.heard': '{done} of {total} heard', 'paths.progress': '{name} progress', 'paths.clear': 'Clear progress', 'paths.heardIt': 'Heard it', 'paths.startWith': ' — start with “{track}”',
  'graph.aria': 'Jazz genre lineage graph. Horizontal position is time; each capsule is a genre spanning its active years.', 'graph.hint': 'Drag to pan · scroll or pinch to zoom · click a genre for its profile, an edge for what it passed on', 'graph.influenceDetail': 'Influence detail', 'graph.inherited': 'Inherited', 'graph.aspectOnly': 'Show only influences that passed on {aspect}', 'graph.all': 'all', 'graph.clearAspect': 'Clear the aspect filter', 'graph.year': 'Year', 'graph.yearAria': 'Show the graph as it stood in this year', 'graph.reset': 'reset', 'graph.showAll': 'Show every genre again', 'graph.how': 'How to read this', 'graph.families': 'Families:', 'graph.legendNote': 'Thickness = strength of influence. The solid block along a capsule marks its peak years.', 'graph.zoomIn': 'Zoom in', 'graph.zoomOut': 'Zoom out', 'graph.fit': 'Fit the whole graph in view', 'graph.resetView': 'Reset view', 'graph.edgeAria': '{from} influenced {to}: {type}', 'graph.filtered': 'Showing only influences that passed on {aspects}.', 'graph.now': 'now', 'graph.close': 'Close', 'graph.strength': '{strength} influence', 'graph.openHinge': 'Open the genre profile containing this record', 'graph.hearHinge': 'Hear the hinge',
  'panel.aria': 'Genre profile', 'panel.close': 'Close genre profile', 'panel.profileAria': '{name} — genre profile', 'panel.opened': '{name} profile opened.', 'panel.alsoCalled': 'Also called: {names}', 'panel.listenFor': 'What to listen for', 'panel.how': 'How it works', 'panel.figures': 'Key figures', 'panel.labels': 'Labels', 'panel.contested': 'Contested', 'panel.hear': 'What to hear', 'panel.gateway': 'Gateway', 'panel.gateway.note': 'the one record to start with', 'panel.core': 'The core', 'panel.core.note': 'what "representative of this genre" means', 'panel.deep': 'Deeper', 'panel.deep.note': 'for after you are hooked', 'panel.alsoFiled': 'Also filed here', 'panel.alsoFiled.note': 'records whose main home is a neighbouring genre', 'panel.gentleHidden': 'Gentle path is on — the more demanding records in this genre are hidden.',
  'album.recordedReleased': 'rec./rel. {year}', 'album.recorded': 'rec. {recorded} · rel. {released}', 'album.startWith': 'start with “{track}”', 'album.filedUnder': 'filed under: {genres}', 'album.listenFor': 'Listen for', 'album.note': 'Note: {note}', 'album.difficulty': 'Difficulty {difficulty} of 5 — {label}', 'album.confidence': '{confidence} confidence', 'album.weak': 'Corroboration for this entry is weaker than for most; see research/notes.md',
  'service.listen': 'Listen to {artist} – {title}', 'service.spotify': 'Search on Spotify', 'service.appleMusic': 'Search on Apple Music', 'service.netease': 'Search on NetEase Cloud Music (网易云音乐)',
  'service.name.spotify': 'Spotify', 'service.name.appleMusic': 'Apple Music', 'service.name.netease': 'NetEase Cloud Music',
  'strength.strong': 'strong', 'strength.moderate': 'moderate', 'strength.weak': 'weak', 'decade.format': '{decade}s',
  'era.present': 'present', 'difficulty.1': 'easy listen', 'difficulty.2': 'approachable', 'difficulty.3': 'some work', 'difficulty.4': 'demanding', 'difficulty.5': 'very demanding', 'confidence.medium': 'medium', 'confidence.low': 'low',
};

/** Exposed for build-time parity checks; application code should use t(). */
export function uiTranslationKeys(localeID) {
  if (localeID === 'zh-CN') return Object.keys(zh);
  if (localeID === 'en') return Object.keys(EN);
  return [];
}

const aspects = {
  harmony: ['harmony', '和声'], rhythm: ['rhythm', '节奏'], form: ['form', '曲式'],
  instrumentation: ['instruments', '配器'], improvisation: ['improvisation', '即兴'],
  timbre: ['timbre', '音色'], repertoire: ['repertoire', '曲目'],
  'social-context': ['social', '社会语境'], technology: ['technology', '技术'],
};

const edgeTypes = {
  'direct-descendant': ['Direct descendant', '直接传承'], 'fusion-of': ['Fusion of', '融合'],
  'reaction-against': ['Reaction against', '反叛'], 'parallel-influence': ['Parallel influence', '平行影响'],
  'revival-of': ['Revival of', '复兴'],
};

const edgeDescriptions = {
  'direct-descendant': ['solid', '实线'], 'fusion-of': ['thick, with a diamond', '粗线，带菱形标记'],
  'reaction-against': ['dashed', '虚线'], 'parallel-influence': ['dotted', '点线'],
  'revival-of': ['hooks backwards in time', '向过去回钩'],
};

const families = {
  'trad-mainstream': ['Traditional & Mainstream', 'Mainstream', '传统与主流', '主流', 'The acoustic through-line: New Orleans to swing to bebop to hard bop to the modern mainstream.', '从新奥尔良、摇摆、比博普到硬博普与当代主流的原声脉络。'],
  avant: ['Avant-Garde & Composed', 'Avant-Garde', '先锋与作曲', '先锋', 'The experimental and composed wing — free jazz, the collectives, European improvisation, chamber jazz.', '实验与作曲的一翼 — 自由爵士、音乐家团体、欧洲即兴与室内爵士。'],
  electric: ['Electric & Crossover', 'Electric', '电声与跨界', '电声', 'Amplified, groove-first and producer-shaped: fusion, funk, and everything downstream of the sampler.', '放大、律动优先并由制作塑形：融合、放克，以及采样器之后的一切。'],
  global: ['Global Currents', 'Global', '全球潮流', '全球', 'Jazz built on rhythmic systems from outside the United States, and the scenes that grew around them.', '建立在美国以外节奏体系之上的爵士，以及围绕它们成长的场景。'],
};

const eras = { trad: ['Trad', '传统'], swing: ['Swing', '摇摆'], modern: ['Modern', '现代'], 'the-break': ['The Break', '转折'], electric: ['Electric', '电声'], postmodern: ['Postmodern', '后现代'] };

const genreNames = {
  ragtime:'拉格泰姆', 'new-orleans':'新奥尔良爵士', 'chicago-jazz':'芝加哥爵士', stride:'跨步钢琴', 'kansas-city':'堪萨斯城爵士', swing:'摇摆与大乐队', manouche:'吉普赛爵士', 'vocal-jazz':'声乐爵士与美国歌本', bebop:'比博普', 'cool-jazz':'冷爵士', 'west-coast':'西海岸爵士', 'hard-bop':'硬博普', 'soul-jazz':'灵魂爵士与风琴三重奏', modal:'调式爵士', 'third-stream':'第三潮流', 'post-bop':'后博普', 'afro-cuban':'非裔古巴与拉丁爵士', 'bossa-brazilian':'波萨诺瓦与巴西爵士', 'ethio-jazz':'埃塞俄比亚爵士', 'j-jazz':'日本爵士', 'euro-free-improv':'欧洲自由即兴', 'free-jazz':'自由爵士', 'aacm-avant':'AACM 与“伟大黑人音乐”', 'spiritual-jazz':'灵性爵士', 'loft-jazz':'阁楼爵士', fusion:'爵士融合', 'jazz-funk':'爵士放克', 'free-funk':'自由放克与和声旋律法', 'smooth-jazz':'柔顺爵士', 'acid-jazz':'酸爵士', 'jazz-rap':'爵士说唱', 'nu-jazz':'新爵士与电子爵士', 'la-beat':'洛杉矶节拍场景爵士', 'ecm-nordic':'ECM 与北欧室内爵士', 'neo-bop':'新博普与“年轻雄狮”', 'm-base':'M-Base 体系', downtown:'市中心与朋克爵士', 'contemporary-creative':'当代创意爵士', 'uk-jazz-revival':'英国爵士复兴'
};

const genreOneLines = {
  ragtime:'写定谱面的钢琴音乐：左手像行军，右手偏不肯落在拍点上。',
  'new-orleans':'三支管乐在进行曲式节奏组上同时即兴不同旋律，居然还能严丝合缝。',
  'chicago-jazz':'大迁徙后的新奥尔良爵士，被从唱片上学会它的年轻人演得更热、更快。',
  stride:'拉格泰姆的左手学会了摇摆，在房租派对上变成钢琴手之间压倒彼此的竞技。',
  'kansas-city':'浸透布鲁斯、以重复乐句搭建的大乐队爵士，节奏组松弛得像在漂浮。',
  swing:'爵士成为美国的流行音乐：为十四人以上乐队编写、天生用于舞蹈的编曲。',
  manouche:'不用鼓、只靠原声吉他演奏的摇摆乐；节奏吉他本身就是整套鼓组。',
  'vocal-jazz':'歌手把写好的歌曲当作原材料，弯折时间、音高和歌词的含义。',
  bebop:'小编制爵士被演得又快又密，快到不再适合跳舞，而要坐下来专心听。',
  'cool-jazz':'把比博普的和声降到一半温度：柔和起音、写定对位，以及热度消退后留下的空间。',
  'west-coast':'搬进洛杉矶录音棚的冷爵士：轻盈、精心编排、旋律优美，演奏者白天往往还为电影配乐。',
  'hard-bop':'把布鲁斯和教堂重新放回比博普 — 更重、更慢，直击胸口。',
  'soul-jazz':'属于街区酒吧的爵士：哈蒙德风琴、吉他、鼓、硬朗律动，并不打算取悦评论家。',
  modal:'拿走大部分和弦，看看独奏者会如何使用留下的空间。',
  'third-stream':'作曲家试图让古典曲式与爵士即兴共处一曲，又不让任何一方占上风。',
  'post-bop':'吸收自由爵士却不放弃曲式的音乐 — 模糊、漂浮，但仍有结构。',
  'afro-cuban':'把爵士和声与独奏建立在古巴克拉韦节奏而非摇摆上，节奏基础由此彻底改变。',
  'bossa-brazilian':'轻声演奏的桑巴，配上爵士和声，以及几乎只比说话稍响的歌声。',
  'ethio-jazz':'埃塞俄比亚五声音阶与爵士放克配器相遇，听起来仿佛同时处在大调与小调。',
  'j-jazz':'日本乐手把调式与灵性爵士推向更硬、更密、录音更发烧的方向。',
  'euro-free-improv':'与爵士彻底切断联系的即兴 — 没有曲调、脉搏、布鲁斯，也没有美国式语汇。',
  'free-jazz':'先放弃和弦进行，后来在某些人手中连拍点与曲式也一并放弃。',
  'aacm-avant':'被组织起来的自由爵士 — 音乐家团体加入作曲、静默、戏剧，以及上百件小乐器。',
  'spiritual-jazz':'以超越性为目标的调式爵士 — 持续音、吟唱、竖琴和漫长的狂喜式推进，近似一种奉献。',
  'loft-jazz':'先锋派第二代，因为俱乐部拒绝预订，只好在自己的公寓里演出。',
  fusion:'爵士插上电，被摇滚音量与放克节奏重造，同时保留即兴的核心。',
  'jazz-funk':'律动就是作品本身 — 乐手围绕低音线和鼓点，而不是和弦进行来建构音乐。',
  'free-funk':'自由爵士落在强硬的放克反拍上，每个人同时演奏一条主旋律。',
  'smooth-jazz':'为电台磨平棱角的爵士放克：旋律在前、独奏简短，不让听众感到不安。',
  'acid-jazz':'DJ 在舞池重新发现七十年代爵士放克，继而请乐队创作听起来像旧唱片的新音乐。',
  'jazz-rap':'嘻哈制作人用爵士唱片搭建节拍，爵士乐手随后作出回应。',
  'nu-jazz':'爵士即兴置于编程电子节奏之上 — 鼓机成为乐队成员，而非伴奏带。',
  'la-beat':'在 J Dilla 与 Flying Lotus 音乐中长大的爵士乐手，用制作人的耳朵与节拍匠的时间感演奏。',
  'ecm-nordic':'围绕空间、静默与延续音建造的爵士；录音精确到房间本身也成了乐器。',
  'neo-bop':'刻意回归原声硬博普与摇摆，由认为融合乐走错方向的学院派高手演奏。',
  'm-base':'在源自西非与离散文化、相互咬合的循环节奏结构上即兴 — 用循环而非合唱段思考爵士。',
  downtown:'自由爵士与硬核朋克、冲浪、克莱兹默和卡通音乐高速相撞，通常毫无预警。',
  'contemporary-creative':'当代先锋主流：节奏错综、和声密集、学院训练扎实，同时吸收一切。',
  'uk-jazz-revival':'建立在加勒比、西非与音响系统节奏上的伦敦爵士，由共同成长、为舞者演奏的音乐家创造。',
};

const pathCopy = {
  'start-here': ['从这里开始', '十二张唱片，按年代排列，轻松入门', '按顺序从音乐发展的每个阶段各选一张容易进入的唱片。重点是在不被高难度吓退的前提下，听见 1921 年至今音乐地基如何移动。'],
  'full-arc': ['完整弧线', '三十张唱片，从拉格泰姆到当代', '按年代梳理爵士乐的历史主干。其中有些唱片并不轻松 — 这条路线要让你听见每一种音乐如何从上一种生长出来，包括那些源自争论与反叛的部分。'],
  'deep-end': ['深入险境', '十五张越来越具挑战的唱片', '自由、灵性与先锋音乐，按难度递进编排，让每张唱片为下一张训练你的耳朵。不要从列表底部开始；体验不会太好。'],
};

export const aspectLabel = (id) => activeLocale === 'zh-CN' ? (aspects[id]?.[1] ?? id) : (aspects[id]?.[0] ?? id);
export const edgeTypeLabel = (id) => activeLocale === 'zh-CN' ? (edgeTypes[id]?.[1] ?? id) : (edgeTypes[id]?.[0] ?? id.replace(/-/g, ' '));
export const edgeDescription = (id) => activeLocale === 'zh-CN' ? (edgeDescriptions[id]?.[1] ?? '') : (edgeDescriptions[id]?.[0] ?? '');
export const familyName = (family) => activeLocale === 'zh-CN' ? (families[family.id]?.[2] ?? family.name) : family.name;
export const familyShort = (family) => activeLocale === 'zh-CN' ? (families[family.id]?.[3] ?? family.short) : family.short;
export const familyBlurb = (family) => activeLocale === 'zh-CN' ? (families[family.id]?.[5] ?? family.blurb) : family.blurb;
export const eraName = (era) => activeLocale === 'zh-CN' ? (eras[era.id]?.[1] ?? era.name) : era.name;
export const genreName = (genre) => activeLocale === 'zh-CN' ? (genreNames[genre.id] ?? genre.name) : genre.name;
export const genreOneLine = (genre) => activeLocale === 'zh-CN' ? (genreOneLines[genre.id] ?? genre.oneLine) : genre.oneLine;
export function pathText(path, field) {
  if (activeLocale !== 'zh-CN' || !pathCopy[path.id]) return path[field];
  return pathCopy[path.id][{ name: 0, subtitle: 1, blurb: 2 }[field]] ?? path[field];
}
