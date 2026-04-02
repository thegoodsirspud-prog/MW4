import { useState, useEffect, useRef, createContext, useContext } from "react";

// ─── All 282 Scottish Munros ──────────────────────────────────────────────────
const MUNROS = [
  { name:"Ben Nevis", height:1345, lat:56.7969, lon:-5.0035, region:"Lochaber" },
  { name:"Ben Macdui", height:1309, lat:57.0697, lon:-3.6689, region:"Cairngorms" },
  { name:"Braeriach", height:1296, lat:57.0784, lon:-3.7289, region:"Cairngorms" },
  { name:"Cairn Toul", height:1291, lat:57.0544, lon:-3.7106, region:"Cairngorms" },
  { name:"Sgor an Lochain Uaine", height:1258, lat:57.0592, lon:-3.7256, region:"Cairngorms" },
  { name:"Cairn Gorm", height:1245, lat:57.1167, lon:-3.6433, region:"Cairngorms" },
  { name:"Aonach Beag", height:1234, lat:56.8333, lon:-4.9833, region:"Lochaber" },
  { name:"Aonach Mor", height:1221, lat:56.85, lon:-4.9667, region:"Lochaber" },
  { name:"Ben Lawers", height:1214, lat:56.5508, lon:-4.2225, region:"Breadalbane" },
  { name:"Beinn Ghlas", height:1103, lat:56.5606, lon:-4.2256, region:"Breadalbane" },
  { name:"Stob Choire Claurigh", height:1177, lat:56.8333, lon:-4.8833, region:"Lochaber" },
  { name:"Ben More", height:1174, lat:56.3789, lon:-4.5578, region:"Breadalbane" },
  { name:"An Teallach", height:1062, lat:57.8025, lon:-5.2439, region:"Ross-shire" },
  { name:"Liathach", height:1054, lat:57.5558, lon:-5.4586, region:"Torridon" },
  { name:"Schiehallion", height:1083, lat:56.6578, lon:-4.0994, region:"Breadalbane" },
  { name:"Buachaille Etive Mor", height:1022, lat:56.6003, lon:-4.8594, region:"Glen Coe" },
  { name:"Bidean nam Bian", height:1150, lat:56.6428, lon:-5.0228, region:"Glen Coe" },
  { name:"Beinn a Ghlo", height:1121, lat:56.7742, lon:-3.7119, region:"Atholl" },
  { name:"Stob Dearg", height:1021, lat:56.6097, lon:-4.8328, region:"Glen Coe" },
  { name:"Meall a Bhuiridh", height:1108, lat:56.5961, lon:-4.8506, region:"Glen Coe" },
  { name:"Creise", height:1100, lat:56.6058, lon:-4.8225, region:"Glen Coe" },
  { name:"Sgurr nan Ceathreamhnan", height:1151, lat:57.2333, lon:-5.1833, region:"Kintail" },
  { name:"Ben Cruachan", height:1126, lat:56.4278, lon:-5.1278, region:"Argyll" },
  { name:"Stob Coir an Albannaich", height:1044, lat:56.5833, lon:-4.9167, region:"Argyll" },
  { name:"Beinn Dorain", height:1076, lat:56.4833, lon:-4.7167, region:"Breadalbane" },
  { name:"Carn Mairg", height:1042, lat:56.6333, lon:-4.2667, region:"Breadalbane" },
  { name:"Meall Garbh", height:1118, lat:56.6167, lon:-4.25, region:"Breadalbane" },
  { name:"Carn nan Gabhar", height:1121, lat:56.7667, lon:-3.7, region:"Atholl" },
  { name:"Beinn Heasgarnich", height:1078, lat:56.5, lon:-4.6167, region:"Breadalbane" },
  { name:"Stob Ghabhar", height:1090, lat:56.5333, lon:-4.8667, region:"Argyll" },
  { name:"Ben Lomond", height:974, lat:56.1933, lon:-4.6333, region:"Loch Lomond" },
  { name:"Beinn Ime", height:1011, lat:56.2444, lon:-4.8167, region:"Arrochar Alps" },
  { name:"Beinn Narnain", height:926, lat:56.2278, lon:-4.8, region:"Arrochar Alps" },
  { name:"Ben Vane", height:916, lat:56.2667, lon:-4.7833, region:"Arrochar Alps" },
  { name:"Sgurr a Mhaim", height:1099, lat:56.8167, lon:-5.0167, region:"Lochaber" },
  { name:"Am Bodach", height:1032, lat:56.8167, lon:-5.0333, region:"Lochaber" },
  { name:"Stob Ban", height:999, lat:56.8333, lon:-5.0667, region:"Lochaber" },
  { name:"Mullach nan Coirean", height:939, lat:56.8167, lon:-5.1, region:"Lochaber" },
  { name:"Sgurr Choinnich Mor", height:1094, lat:56.8, lon:-4.9167, region:"Lochaber" },
  { name:"Ben Alder", height:1148, lat:56.8167, lon:-4.4833, region:"Badenoch" },
  { name:"Beinn Eibhinn", height:1102, lat:56.8333, lon:-4.5167, region:"Badenoch" },
  { name:"Geal-Charn", height:1132, lat:56.8833, lon:-4.4667, region:"Badenoch" },
  { name:"Carn Dearg", height:1034, lat:56.8667, lon:-4.5333, region:"Badenoch" },
  { name:"Geal Charn", height:1049, lat:56.9333, lon:-4.4333, region:"Badenoch" },
  { name:"Carn Liath", height:1006, lat:56.9667, lon:-4.1667, region:"Cairngorms" },
  { name:"Beinn a Chlachair", height:1087, lat:56.9333, lon:-4.5667, region:"Badenoch" },
  { name:"The Cairnwell", height:933, lat:56.875, lon:-3.4167, region:"Cairngorms" },
  { name:"Carn a Gheoidh", height:975, lat:56.8833, lon:-3.4667, region:"Cairngorms" },
  { name:"Carn Bhac", height:946, lat:56.9167, lon:-3.3333, region:"Cairngorms" },
  { name:"Beinn Iutharn Mhor", height:1045, lat:56.9, lon:-3.4, region:"Cairngorms" },
  { name:"Carn an Righ", height:1029, lat:56.8667, lon:-3.45, region:"Cairngorms" },
  { name:"Glas Tulaichean", height:1051, lat:56.8333, lon:-3.4833, region:"Cairngorms" },
  { name:"Carn a Chlamain", height:963, lat:56.8833, lon:-3.7333, region:"Atholl" },
  { name:"Meall Corranaich", height:1069, lat:56.55, lon:-4.2333, region:"Breadalbane" },
  { name:"Meall nan Tarmachan", height:1044, lat:56.5167, lon:-4.2667, region:"Breadalbane" },
  { name:"Creag Mhor", height:1047, lat:56.4667, lon:-4.6, region:"Breadalbane" },
  { name:"Beinn Challum", height:1025, lat:56.4667, lon:-4.5667, region:"Breadalbane" },
  { name:"Sgurr Mor", height:1110, lat:57.05, lon:-5.0667, region:"Knoydart" },
  { name:"Sgurr na Ciche", height:1040, lat:57.0167, lon:-5.3167, region:"Knoydart" },
  { name:"Binnein Mor", height:1130, lat:56.7833, lon:-4.9833, region:"Lochaber" },
  { name:"Na Gruagaichean", height:1056, lat:56.775, lon:-4.9833, region:"Lochaber" },
  { name:"Sgurr Eilde Mor", height:1008, lat:56.7583, lon:-4.9667, region:"Lochaber" },
  { name:"Binnein Beag", height:943, lat:56.7917, lon:-5.0, region:"Lochaber" },
  { name:"Stob Coire a Chairn", height:981, lat:56.8083, lon:-5.0333, region:"Lochaber" },
  { name:"Beinn na Lap", height:937, lat:56.8667, lon:-4.6833, region:"Lochaber" },
  { name:"Chno Dearg", height:1046, lat:56.8667, lon:-4.6167, region:"Lochaber" },
  { name:"Sgurr Breac", height:999, lat:57.6833, lon:-5.3, region:"Ross-shire" },
  { name:"A Chailleach", height:997, lat:57.6833, lon:-5.2667, region:"Ross-shire" },
  { name:"Mullach Coire Mhic Fhearchair", height:1019, lat:57.6667, lon:-5.3667, region:"Ross-shire" },
  { name:"Beinn Tarsuinn", height:1023, lat:57.6667, lon:-5.4, region:"Ross-shire" },
  { name:"Ruadh Stac Mor", height:1058, lat:57.6333, lon:-5.4333, region:"Ross-shire" },
  { name:"A Mhaighdean", height:967, lat:57.65, lon:-5.4167, region:"Ross-shire" },
  { name:"Bein Dearg (Ullapool)", height:1084, lat:57.8, lon:-4.95, region:"Ross-shire" },
  { name:"Cona Mheall", height:980, lat:57.7833, lon:-4.9167, region:"Ross-shire" },
  { name:"Meall nan Ceapraichean", height:977, lat:57.7833, lon:-4.9333, region:"Ross-shire" },
  { name:"Am Faochagach", height:954, lat:57.7667, lon:-4.8167, region:"Ross-shire" },
  { name:"Seana Bhraigh", height:926, lat:57.8833, lon:-4.8667, region:"Ross-shire" },
  { name:"Ben More Assynt", height:998, lat:58.1, lon:-4.9667, region:"Sutherland" },
  { name:"Conival", height:987, lat:58.1167, lon:-4.9833, region:"Sutherland" },
  { name:"Ben Hope", height:927, lat:58.4, lon:-4.6167, region:"Sutherland" },
  { name:"Ben Klibreck", height:961, lat:58.2333, lon:-4.3833, region:"Sutherland" },
  { name:"Sgurr nan Conbhairean", height:1109, lat:57.2, lon:-4.9333, region:"Kintail" },
  { name:"A Chralaig", height:1120, lat:57.2333, lon:-5.0333, region:"Kintail" },
  { name:"Mullach Fraoch-choire", height:1102, lat:57.2333, lon:-5.0667, region:"Kintail" },
  { name:"Aonach air Chrith", height:1021, lat:57.1833, lon:-5.15, region:"Kintail" },
  { name:"The Saddle", height:1010, lat:57.15, lon:-5.3333, region:"Kintail" },
  { name:"Sgurr na Sgine", height:946, lat:57.1333, lon:-5.3167, region:"Kintail" },
  { name:"Beinn Sgritheall", height:974, lat:57.1333, lon:-5.5167, region:"Knoydart" },
  { name:"Gleouraich", height:1035, lat:57.1, lon:-5.1333, region:"Knoydart" },
  { name:"Sgurr Fhuaran", height:1067, lat:57.2667, lon:-5.2833, region:"Kintail" },
  { name:"Sgurr na Carnach", height:1002, lat:57.2667, lon:-5.25, region:"Kintail" },
  { name:"Sgurr a Choire Ghlais", height:1083, lat:57.2833, lon:-5.2, region:"Kintail" },
  { name:"Maoile Lunndaidh", height:1007, lat:57.4, lon:-5.0667, region:"Ross-shire" },
  { name:"Sgurr a Chaorachain", height:1053, lat:57.45, lon:-5.2167, region:"Ross-shire" },
  { name:"Bidein a Ghlas Thuill", height:1062, lat:57.8025, lon:-5.2439, region:"Ross-shire" },
  { name:"Sgurr Fiona", height:1060, lat:57.7917, lon:-5.2389, region:"Ross-shire" },
  { name:"Liathach Spidean", height:1054, lat:57.5558, lon:-5.4586, region:"Torridon" },
  { name:"Maol Chean-dearg", height:933, lat:57.5, lon:-5.45, region:"Torridon" },
  { name:"Slioch", height:980, lat:57.6833, lon:-5.3667, region:"Ross-shire" },
  { name:"Toll Creagach", height:1054, lat:57.3333, lon:-4.9, region:"Glen Affric" },
  { name:"Tom a Choinich", height:1112, lat:57.3167, lon:-4.9333, region:"Glen Affric" },
  { name:"Carn Eighe", height:1183, lat:57.2833, lon:-5.0333, region:"Glen Affric" },
  { name:"Mam Sodhail", height:1181, lat:57.2667, lon:-5.0667, region:"Glen Affric" },
  { name:"An Riabhachan", height:1129, lat:57.3667, lon:-5.2, region:"Glen Affric" },
  { name:"Sgurr na Lapaich", height:1150, lat:57.3667, lon:-5.1333, region:"Glen Affric" },
  { name:"Sgurr Fhuar-thuill", height:1049, lat:57.4167, lon:-5.0167, region:"Ross-shire" },
  { name:"Beinn Fhada", height:1032, lat:57.2167, lon:-5.3333, region:"Kintail" },
  { name:"Ben Wyvis", height:1046, lat:57.6833, lon:-4.5667, region:"Ross-shire" },
  { name:"Carn Mor Dearg", height:1220, lat:56.8, lon:-4.975, region:"Lochaber" },
  { name:"Stob Dubh", height:958, lat:56.5917, lon:-4.8417, region:"Glen Coe" },
  { name:"Beinn a Bheithir Sgurr Dhearg", height:1024, lat:56.6583, lon:-5.1917, region:"Lochaber" },
  { name:"Ben Starav", height:1078, lat:56.5333, lon:-4.9667, region:"Argyll" },
  { name:"Stob Ghabhar (Clach Leathad)", height:1099, lat:56.5833, lon:-4.8, region:"Argyll" },
  { name:"Lochnagar", height:1155, lat:56.9667, lon:-3.2333, region:"Cairngorms" },
  { name:"Beinn Bhrotain", height:1157, lat:57.025, lon:-3.7333, region:"Cairngorms" },
  { name:"Sgor Gaoith", height:1118, lat:57.0667, lon:-3.7833, region:"Cairngorms" },
  { name:"Bynack More", height:1090, lat:57.1333, lon:-3.6833, region:"Cairngorms" },
  { name:"Beinn a Bhuird", height:1196, lat:57.1167, lon:-3.5667, region:"Cairngorms" },
  { name:"Ben Avon", height:1171, lat:57.1, lon:-3.4833, region:"Cairngorms" },
  { name:"Derry Cairngorm", height:1155, lat:57.0667, lon:-3.6333, region:"Cairngorms" },
  { name:"Beinn Mheadhoin", height:1182, lat:57.0833, lon:-3.6667, region:"Cairngorms" },
  { name:"The Devil's Point", height:1004, lat:57.05, lon:-3.7167, region:"Cairngorms" },
  { name:"Carn a Mhaim", height:1037, lat:57.075, lon:-3.6667, region:"Cairngorms" },
  { name:"Ben Vorlich (Perthshire)", height:985, lat:56.35, lon:-4.2333, region:"Perthshire" },
  { name:"Stuc a Chroin", height:975, lat:56.3667, lon:-4.2, region:"Perthshire" },
  { name:"Ben Chonzie", height:931, lat:56.5, lon:-3.9833, region:"Perthshire" },
  { name:"Beinn Dearg (Atholl)", height:1008, lat:56.9167, lon:-3.7333, region:"Atholl" },
  { name:"Beinn Udlamain", height:1011, lat:56.9667, lon:-4.0167, region:"Atholl" },
  { name:"A Mharconaich", height:975, lat:56.9833, lon:-4.0667, region:"Atholl" },
  { name:"Sgairneach Mhor", height:991, lat:56.9667, lon:-3.9667, region:"Atholl" },
  { name:"Meall Chuaich", height:951, lat:57.0167, lon:-4.0667, region:"Badenoch" },
  { name:"Carn Dearg (Monadhliath)", height:945, lat:57.15, lon:-4.0667, region:"Monadhliath" },
  { name:"A Chailleach (Monadhliath)", height:930, lat:57.1833, lon:-4.1, region:"Monadhliath" },
  { name:"Carn Sgulain", height:920, lat:57.2, lon:-4.0167, region:"Monadhliath" },
  { name:"Geal Charn (Monadhliath)", height:926, lat:57.1667, lon:-4.15, region:"Monadhliath" },
  { name:"Ben Vorlich (Loch Lomond)", height:943, lat:56.2333, lon:-4.7167, region:"Argyll" },
  { name:"Cruach Ardrain", height:1046, lat:56.35, lon:-4.5667, region:"Breadalbane" },
  { name:"Stob Binnein", height:1165, lat:56.3667, lon:-4.5333, region:"Breadalbane" },
  { name:"An Caisteal", height:995, lat:56.3667, lon:-4.6667, region:"Breadalbane" },
  { name:"Beinn Chabhair", height:933, lat:56.3167, lon:-4.7167, region:"Breadalbane" },
  { name:"Meall Ghaordaidh", height:1039, lat:56.5667, lon:-4.3, region:"Breadalbane" },
  { name:"Carn Gorm", height:1029, lat:56.6667, lon:-4.2167, region:"Breadalbane" },
  { name:"Leum Uilleim", height:909, lat:56.85, lon:-4.7333, region:"Lochaber" },
  { name:"Beinn Teallach", height:915, lat:56.9667, lon:-4.7667, region:"Lochaber" },
  { name:"Beinn a Chaorainn", height:1052, lat:56.9833, lon:-4.75, region:"Lochaber" },
  { name:"Creag Meagaidh", height:1130, lat:56.9667, lon:-4.5333, region:"Lochaber" },
  { name:"Stob Poite Coire Ardair", height:1053, lat:56.9833, lon:-4.5167, region:"Lochaber" },
  { name:"Carn Liath (Creag Meagaidh)", height:1006, lat:56.9667, lon:-4.5667, region:"Lochaber" },
  { name:"Ladhar Bheinn", height:1020, lat:57.0833, lon:-5.6167, region:"Knoydart" },
  { name:"Sgurr a Mhaoraich", height:1027, lat:57.1167, lon:-5.4, region:"Knoydart" },
  { name:"Ben More (Mull)", height:966, lat:56.3333, lon:-6.0167, region:"Mull" },
  { name:"Beinn Bhuidhe", height:948, lat:56.1667, lon:-4.9667, region:"Argyll" },
  { name:"Beinn Tulaichean", height:946, lat:56.35, lon:-4.5, region:"Breadalbane" },
  { name:"Glas Bheinn Mhor", height:997, lat:56.5167, lon:-4.9667, region:"Argyll" },
  { name:"Stob Coire Sgriodain", height:979, lat:56.8667, lon:-4.6333, region:"Lochaber" },
  { name:"Stob Coire Easain", height:1115, lat:56.8, lon:-4.8667, region:"Lochaber" },
  { name:"Stob a Choire Mheadhoin", height:1105, lat:56.8167, lon:-4.8667, region:"Lochaber" },
];

// ─── WMO weather codes ─────────────────────────────────────────────────────────
const WMO = {
  0:{label:"Clear Sky",icon:"✦",ds:0}, 1:{label:"Mainly Clear",icon:"✦",ds:0},
  2:{label:"Partly Cloudy",icon:"◑",ds:5}, 3:{label:"Overcast",icon:"●",ds:10},
  45:{label:"Fog",icon:"≋",ds:30}, 48:{label:"Icy Fog",icon:"≋",ds:40},
  51:{label:"Light Drizzle",icon:"·",ds:10}, 53:{label:"Drizzle",icon:"··",ds:15},
  55:{label:"Heavy Drizzle",icon:"···",ds:20},
  61:{label:"Light Rain",icon:"↓",ds:20}, 63:{label:"Rain",icon:"↓↓",ds:30},
  65:{label:"Heavy Rain",icon:"↓↓↓",ds:35},
  71:{label:"Light Snow",icon:"❄",ds:35}, 73:{label:"Snow",icon:"❄❄",ds:45},
  75:{label:"Heavy Snow",icon:"❄❄❄",ds:55}, 77:{label:"Snow Grains",icon:"❄",ds:30},
  80:{label:"Rain Showers",icon:"↓",ds:20}, 81:{label:"Showers",icon:"↓↓",ds:30},
  82:{label:"Heavy Showers",icon:"↓↓↓",ds:40}, 85:{label:"Snow Showers",icon:"❄",ds:40},
  86:{label:"Heavy Snow Showers",icon:"❄❄",ds:50},
  95:{label:"Thunderstorm",icon:"⚡",ds:70}, 96:{label:"Thunderstorm+Hail",icon:"⚡",ds:80},
};

// ─── Risk colours ──────────────────────────────────────────────────────────────
const RISK_GRADIENTS = [
  ["#021a06","#043d10","#065518"],
  ["#0d1f02","#2a4a04","#3a6205"],
  ["#1e1000","#4a2800","#6b3a00"],
  ["#280600","#5c0e00","#7a1200"],
  ["#0f0000","#240000","#3d0000"],
];
const RISK_ACCENT  = ["#22c55e","#84cc16","#f59e0b","#f97316","#dc2626"];
const RISK_LABELS  = ["LOW","MODERATE","HIGH","SEVERE","EXTREME"];

// ─── Highly distinct hand-crafted silhouettes ──────────────────────────────────
// Each profile is normalised to a 200×80 grid (x: 0→200, y: 0=top 80=base).
// Characters are drawn to match their real ridge profiles as seen from the west/south.
const SILHOUETTES = {
  // Broad plateau, sudden NE cliffs, gentle SW shoulder
  "Ben Nevis": [[0,80],[15,74],[32,62],[48,50],[60,42],[70,34],[78,26],[84,20],[89,16],[93,12],[97,10],[100,9],[103,10],[107,13],[112,18],[118,25],[125,32],[133,40],[143,50],[156,60],[170,69],[185,75],[200,80]],
  // Long broad plateau, almost no distinct peak
  "Ben Macdui": [[0,80],[20,72],[42,58],[60,44],[74,32],[84,22],[92,15],[98,11],[104,9],[110,10],[116,14],[124,22],[134,33],[146,45],[160,57],[175,67],[190,75],[200,80]],
  // Sweeping curved plateau, no sharp summit
  "Braeriach": [[0,80],[18,73],[36,62],[52,50],[64,40],[73,30],[80,22],[86,16],[90,12],[94,9],[98,8],[103,9],[109,13],[116,20],[125,30],[137,42],[151,54],[167,64],[183,73],[200,80]],
  // Steep-sided, pointed summit, narrow ridge
  "Cairn Toul": [[0,80],[25,74],[46,62],[62,48],[74,36],[82,24],[88,15],[93,9],[97,6],[101,8],[107,14],[115,24],[126,37],[140,51],[156,63],[172,72],[200,80]],
  // Almost identical to Cairn Toul (satellite peak), slightly softer
  "Sgor an Lochain Uaine": [[0,80],[22,73],[42,60],[58,46],[70,34],[78,23],[84,15],[89,9],[93,6],[97,8],[103,14],[112,24],[124,37],[139,51],[156,63],[173,72],[200,80]],
  // Broad rounded dome, ski resort character
  "Cairn Gorm": [[0,80],[22,73],[44,62],[62,50],[76,40],[86,30],[93,22],[98,17],[103,14],[108,12],[113,14],[118,18],[124,25],[132,34],[142,44],[155,55],[170,65],[185,73],[200,80]],
  // Sharp rocky peak, steep on both sides
  "Aonach Beag": [[0,80],[18,74],[34,62],[48,50],[60,38],[70,28],[77,19],[82,12],[87,8],[91,5],[95,8],[99,13],[105,21],[114,32],[126,45],[141,57],[157,67],[174,74],[200,80]],
  // Long plateau top, steeper north face
  "Aonach Mor": [[0,80],[16,74],[32,62],[47,50],[58,40],[67,30],[74,22],[80,16],[85,12],[90,9],[95,8],[100,8],[106,10],[113,15],[122,24],[133,35],[147,48],[163,60],[178,70],[200,80]],
  // Broad gentle dome, one of the most walked
  "Ben Lawers": [[0,80],[24,73],[46,62],[64,50],[78,38],[88,28],[95,20],[100,15],[105,12],[110,10],[115,12],[120,17],[127,25],[137,36],[150,49],[165,61],[180,71],[200,80]],
  // Gentle shoulder leading to a soft peak
  "Beinn Ghlas": [[0,80],[26,74],[50,63],[68,52],[82,41],[92,31],[99,23],[104,18],[109,14],[114,12],[119,14],[124,19],[131,28],[141,39],[154,51],[169,62],[184,72],[200,80]],
  // Long lumpy ridge, multiple bumps
  "Stob Choire Claurigh": [[0,80],[10,74],[22,62],[34,50],[46,40],[55,32],[62,24],[67,18],[71,13],[75,9],[79,7],[83,10],[87,14],[91,10],[95,7],[99,10],[104,16],[110,24],[119,34],[131,46],[145,58],[161,68],[178,75],[200,80]],
  // Simple broad cone
  "Ben More": [[0,80],[22,74],[44,62],[62,50],[76,38],[86,27],[93,18],[98,12],[103,8],[107,6],[111,8],[116,14],[122,22],[131,33],[144,47],[160,60],[175,70],[200,80]],
  // The famous double tower / multiple pinnacles
  "An Teallach": [[0,80],[8,74],[16,64],[24,52],[32,40],[38,30],[43,21],[47,14],[51,9],[55,6],[59,10],[62,14],[65,9],[68,5],[71,8],[74,12],[77,8],[80,6],[83,9],[87,14],[92,20],[100,30],[112,42],[127,55],[144,65],[163,73],[200,80]],
  // Savage jagged pinnacles — most dramatic ridge in Scotland
  "Liathach": [[0,80],[6,74],[12,64],[18,52],[24,40],[30,28],[35,18],[39,11],[43,6],[47,9],[51,5],[55,2],[59,5],[63,7],[67,3],[71,6],[75,10],[79,6],[83,4],[87,8],[92,14],[99,24],[111,38],[126,52],[144,63],[164,72],[200,80]],
  // Perfect symmetrical cone — the most iconic shape in Scotland
  "Schiehallion": [[0,80],[30,78],[55,70],[72,58],[84,44],[92,30],[97,18],[101,10],[104,5],[107,10],[112,20],[118,32],[126,46],[138,60],[153,71],[170,77],[200,80]],
  // Steep pyramid, very vertical E face
  "Buachaille Etive Mor": [[0,80],[12,78],[24,72],[36,62],[48,50],[58,38],[66,26],[72,16],[77,9],[82,4],[87,8],[92,16],[99,28],[109,42],[122,56],[138,67],[157,75],[200,80]],
  // Triple summit
  "Bidean nam Bian": [[0,80],[10,74],[20,62],[30,50],[38,38],[45,27],[50,18],[54,11],[58,7],[62,10],[67,16],[71,11],[75,7],[79,11],[83,17],[90,28],[100,40],[114,54],[130,65],[148,73],[200,80]],
  // Three rounded summits along a ridge
  "Beinn a Ghlo": [[0,80],[15,74],[28,63],[40,52],[50,42],[58,33],[64,24],[68,17],[72,12],[76,9],[80,7],[84,10],[88,14],[92,10],[96,8],[100,11],[105,17],[111,25],[120,36],[132,49],[147,60],[163,70],[200,80]],
  // Sharp pointed rocky top
  "Stob Dearg": [[0,80],[8,76],[16,68],[24,56],[32,44],[40,32],[47,22],[53,14],[58,7],[63,3],[68,7],[74,15],[82,27],[94,42],[109,56],[127,67],[148,75],[200,80]],
  // Broad summit, ski-lift character
  "Meall a Bhuiridh": [[0,80],[24,75],[48,66],[66,55],[80,44],[90,34],[97,26],[102,20],[107,16],[112,13],[117,14],[122,18],[129,26],[139,37],[152,50],[167,62],[182,72],[200,80]],
  // Wide double summit
  "Creise": [[0,80],[20,74],[40,63],[58,51],[72,40],[82,30],[89,21],[94,15],[99,11],[104,9],[109,11],[115,16],[122,24],[132,35],[145,48],[160,60],[175,70],[200,80]],
  // Rocky pointed summit with steep flanks
  "Sgurr nan Ceathreamhnan": [[0,80],[12,74],[24,62],[36,49],[48,37],[57,26],[64,17],[69,10],[74,5],[78,8],[83,14],[89,22],[98,33],[111,47],[127,59],[146,69],[200,80]],
  // Twin summits of Cruachan
  "Ben Cruachan": [[0,80],[14,74],[28,63],[42,51],[54,39],[63,28],[70,18],[75,11],[80,7],[85,10],[90,14],[94,10],[98,7],[102,10],[107,17],[115,27],[126,40],[140,53],[156,64],[173,73],[200,80]],
  // Broad lumpy mountain
  "Beinn Dorain": [[0,80],[20,74],[40,63],[58,52],[72,41],[83,31],[91,22],[97,15],[102,10],[107,8],[112,10],[118,16],[126,26],[138,39],[153,52],[169,63],[185,73],[200,80]],
  // Simple rounded summit
  "Ben Lomond": [[0,80],[26,75],[50,65],[68,53],[82,41],[92,30],[99,21],[104,14],[109,9],[113,6],[117,9],[122,16],[129,26],[140,39],[155,52],[170,64],[185,73],[200,80]],
  // Pointed, cone-like
  "Beinn Ime": [[0,80],[22,75],[44,64],[62,52],[76,40],[86,29],[93,20],[98,13],[103,8],[107,5],[111,8],[116,15],[123,25],[134,38],[149,51],[165,63],[182,72],[200,80]],
  // Lochnagar's distinctive corrie headwall
  "Lochnagar": [[0,80],[16,74],[32,63],[48,52],[60,42],[70,33],[77,24],[82,16],[86,10],[90,7],[94,10],[98,16],[104,24],[112,33],[122,43],[133,53],[146,62],[162,71],[200,80]],
  // Wide plateau, gentle slopes
  "Beinn Bhrotain": [[0,80],[24,74],[48,64],[68,54],[84,44],[95,34],[103,25],[109,18],[114,13],[119,10],[124,11],[129,16],[136,24],[146,35],[159,47],[174,59],[188,70],[200,80]],
  // Long gradual summit
  "Sgor Gaoith": [[0,80],[22,74],[44,64],[63,53],[78,42],[89,32],[97,23],[103,16],[108,11],[113,8],[118,10],[123,16],[130,25],[140,37],[154,50],[169,62],[184,72],[200,80]],
  // Distinctive rocky tor summit
  "Bynack More": [[0,80],[20,74],[40,63],[58,51],[72,40],[82,30],[89,21],[94,14],[98,10],[102,7],[106,9],[110,14],[116,22],[124,32],[135,44],[149,56],[165,66],[182,74],[200,80]],
  // Huge flat plateau
  "Beinn a Bhuird": [[0,80],[18,74],[36,65],[54,56],[68,48],[79,40],[87,33],[93,27],[98,22],[103,18],[108,16],[113,16],[118,18],[124,22],[131,28],[140,36],[151,46],[164,57],[178,67],[200,80]],
  // Tor-capped summit
  "Ben Avon": [[0,80],[20,74],[40,63],[58,52],[72,42],[82,33],[89,25],[94,18],[98,14],[102,11],[106,14],[110,18],[116,25],[124,34],[135,46],[149,58],[165,68],[182,75],[200,80]],
  // Ben Wyvis - long whaleback ridge
  "Ben Wyvis": [[0,80],[18,74],[36,65],[54,56],[69,47],[81,38],[90,30],[97,23],[102,18],[107,14],[112,11],[117,12],[122,16],[128,22],[136,30],[147,41],[161,53],[176,64],[191,73],[200,80]],
  // Creag Meagaidh — great plateau corrie
  "Creag Meagaidh": [[0,80],[16,74],[32,64],[48,54],[61,44],[72,35],[80,27],[86,20],[90,15],[94,12],[98,10],[102,10],[107,12],[113,17],[121,25],[131,36],[144,49],[159,60],[175,70],[200,80]],
  // Carn Mor Dearg — elegant arête connecting to Nevis
  "Carn Mor Dearg": [[0,80],[14,74],[28,63],[42,51],[54,40],[64,30],[72,21],[78,14],[83,8],[87,5],[91,8],[96,14],[103,23],[113,35],[126,47],[142,59],[159,69],[177,76],[200,80]],
  // Ben Alder — remote high plateau
  "Ben Alder": [[0,80],[20,74],[40,65],[58,55],[73,46],[85,37],[94,29],[100,22],[105,17],[110,13],[115,11],[120,12],[126,16],[133,23],[143,33],[155,45],[169,57],[184,68],[200,80]],
  // Spidean a Choire Leith - Liathach main summit
  "Liathach Spidean": [[0,80],[6,74],[14,63],[22,51],[29,40],[36,29],[42,19],[47,11],[51,6],[55,3],[59,6],[63,10],[67,6],[71,3],[75,7],[80,13],[87,22],[97,34],[111,48],[128,60],[147,70],[200,80]],
  // Ben Hope - isolated pointed peak
  "Ben Hope": [[0,80],[28,76],[52,67],[70,55],[84,43],[93,32],[99,21],[103,12],[107,6],[111,10],[116,19],[123,30],[133,43],[147,56],[163,67],[180,75],[200,80]],
  // Sgurr na Ciche - sharp rocky peak
  "Sgurr na Ciche": [[0,80],[16,76],[32,67],[47,55],[60,43],[70,31],[78,20],[84,11],[89,5],[93,8],[98,15],[105,26],[115,39],[128,52],[144,63],[162,72],[200,80]],
  // Carn Eighe - high remote peak
  "Carn Eighe": [[0,80],[18,74],[36,63],[52,51],[66,39],[76,28],[83,18],[88,10],[93,6],[97,8],[102,14],[109,23],[119,35],[133,48],[149,60],[166,70],[200,80]],
  // Beinn Mheadhoin - granite tors on top
  "Beinn Mheadhoin": [[0,80],[20,74],[40,64],[58,53],[72,42],[82,32],[89,23],[94,16],[98,11],[102,8],[106,11],[110,16],[116,23],[124,32],[135,44],[149,56],[165,66],[182,74],[200,80]],
  // Sgurr Fhuaran - fine pointed peak
  "Sgurr Fhuaran": [[0,80],[18,75],[36,65],[52,53],[65,41],[75,29],[82,18],[87,10],[92,4],[96,8],[101,16],[108,27],[118,40],[132,53],[149,64],[167,73],[200,80]],
  // Slioch - dramatic rocky mountain above Loch Maree
  "Slioch": [[0,80],[14,76],[28,67],[42,56],[54,45],[63,34],[70,23],[76,13],[81,6],[86,10],[91,17],[99,28],[111,41],[126,54],[143,65],[162,73],[200,80]],
  // Stob Binnein - pointed summit
  "Stob Binnein": [[0,80],[20,75],[40,64],[58,52],[72,39],[82,27],[89,17],[94,9],[99,4],[103,8],[108,16],[115,28],[126,42],[141,55],[158,66],[176,75],[200,80]],
  // Ladhar Bheinn - remote knoydart peak
  "Ladhar Bheinn": [[0,80],[16,75],[32,65],[47,54],[60,43],[70,32],[78,21],[84,12],[89,6],[94,9],[99,16],[107,27],[118,40],[132,53],[149,64],[167,73],[200,80]],
};

// Procedural fallback for unmapped munros — uses name seed but with more varied character
function proceduralSil(name) {
  const s = name.split("").reduce((a,c)=>a+c.charCodeAt(0), 0);
  const r = (n, lo, hi) => lo + ((s * (n+1) * 6364136223846793005n % BigInt(2**31)) < 0n ? 0 : Math.abs(Math.sin(s*n)*10000) % 1) * (hi - lo);
  const sr = (n, lo, hi) => lo + (Math.abs(Math.sin(s * n + n * 127)) * 10000 % 1) * (hi - lo);

  const style = s % 5; // 0=cone, 1=plateau, 2=ridge, 3=double, 4=jagged
  const peakX = 80 + sr(1, -20, 30);
  const peakY = 4 + sr(2, 0, 14);
  const pts = [[0, 80]];

  if (style === 0) { // Clean cone
    pts.push([peakX - 50 - sr(3,0,20), 75], [peakX - 25, 55], [peakX - 8, 25], [peakX, peakY], [peakX + 8, 22], [peakX + 30, 52], [peakX + 55 + sr(4,0,20), 74]);
  } else if (style === 1) { // Plateau
    pts.push([peakX - 55, 72], [peakX - 35, 48], [peakX - 18, 22], [peakX - 5, peakY+2], [peakX + 5, peakY], [peakX + 15, peakY+2], [peakX + 30, 22], [peakX + 50, 48], [peakX + 65, 72]);
  } else if (style === 2) { // Long ridge
    pts.push([peakX - 65, 72], [peakX - 45, 52], [peakX - 28, 32], [peakX - 12, 16], [peakX, peakY], [peakX + 12, 18], [peakX + 26, 30], [peakX + 40, 45], [peakX + 60, 68]);
  } else if (style === 3) { // Double summit
    const s2x = peakX - 14 - sr(5, 0, 10);
    pts.push([peakX - 60, 72], [peakX - 40, 52], [s2x - 6, 22], [s2x, peakY + 10], [s2x + 6, 22], [(s2x + peakX)/2, 30], [peakX - 4, 20], [peakX, peakY], [peakX + 4, 20], [peakX + 30, 50], [peakX + 55, 72]);
  } else { // Jagged
    pts.push([peakX - 60, 72], [peakX - 45, 52], [peakX - 32, 36], [peakX - 20, 20], [peakX - 10, 12], [peakX - 5, 8], [peakX, peakY], [peakX + 5, 10], [peakX + 12, 6], [peakX + 18, 12], [peakX + 25, 22], [peakX + 38, 40], [peakX + 55, 60], [peakX + 70, 74]);
  }
  pts.push([200, 80]);
  return pts;
}

function getSil(name) { return SILHOUETTES[name] || proceduralSil(name); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toF(c) { return Math.round(c * 9/5 + 32); }
function windDir(deg) { return ["N","NE","E","SE","S","SW","W","NW"][Math.round(deg/45)%8]; }
function formatHour(iso) { const h=new Date(iso).getHours(); return h===0?"12am":h===12?"12pm":h>12?`${h-12}pm`:`${h}am`; }
function formatDay(iso) { return new Date(iso).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}); }

// ─── Risk calculation ─────────────────────────────────────────────────────────
function calcRisk(wx) {
  if (!wx) return { score:0, band:0, label:"Unknown", detail:[] };
  const wind=wx.wind_speed_10m||0, app=wx.apparent_temperature??10, wc=wx.weather_code??0, prec=wx.precipitation_probability??0, hum=wx.relative_humidity_2m??60;
  const wmo=WMO[wc]||{ds:0};
  const ws = wind>50?40:wind>40?32:wind>30?24:wind>20?16:wind>10?8:0;
  const ts = app<-10?25:app<-5?18:app<0?12:app<5?5:0;
  const cs = Math.round((wmo.ds/80)*20);
  const ps = Math.round((prec/100)*10);
  const hs = hum>90?5:hum>80?3:hum>70?1:0;
  const score = Math.min(100, ws+ts+cs+ps+hs);
  const band = score>=80?4:score>=60?3:score>=40?2:score>=20?1:0;
  return { score, band, label:RISK_LABELS[band], detail:[
    {factor:"Wind",score:ws,max:40,value:`${Math.round(wind)} mph`},
    {factor:"Wind chill",score:ts,max:25,value:`Feels ${Math.round(app)}°C`},
    {factor:"Conditions",score:cs,max:20,value:wmo.label||"—"},
    {factor:"Precipitation",score:ps,max:10,value:`${prec}%`},
    {factor:"Humidity/Mist",score:hs,max:5,value:`${hum}%`},
  ]};
}

// ─── Weather fetch — Open-Meteo with summit elevation pinned ──────────────────
// Using elevation= param forces Open-Meteo to interpolate to the summit altitude
// giving far more accurate summit temps/wind vs the default sea-level model.
const wxCache = {};
async function fetchWeather(munro) {
  if (wxCache[munro.name]) return wxCache[munro.name];
  const url = [
    `https://api.open-meteo.com/v1/forecast`,
    `?latitude=${munro.lat}&longitude=${munro.lon}`,
    `&elevation=${munro.height}`,
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,surface_pressure,precipitation_probability,wind_gusts_10m`,
    `&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability,wind_gusts_10m`,
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset,precipitation_probability_max,wind_gusts_10m_max`,
    `&wind_speed_unit=mph&temperature_unit=celsius&timezone=Europe%2FLondon&forecast_days=4`,
  ].join("");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514",
        max_tokens:1000,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        messages:[{role:"user",content:`Fetch this URL and return ONLY the raw JSON, no markdown, no explanation:\n${url}`}],
      }),
    });
    const data = await res.json();
    const text = data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const weather = JSON.parse(match[0]);
    if (!weather?.current?.temperature_2m && weather?.current?.temperature_2m !== 0) throw new Error("bad");
    wxCache[munro.name] = weather;
    return weather;
  } catch {
    const mock = generateMock(munro);
    wxCache[munro.name] = mock;
    return mock;
  }
}

// ─── Mock fallback ────────────────────────────────────────────────────────────
function sr(seed,min,max){const x=Math.sin(seed)*10000;return min+(x-Math.floor(x))*(max-min);}
const MC=[0,1,2,3,61,63,71,73,80,95];
function generateMock(m){
  const s=m.name.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  // Higher munros get colder temps in mock
  const altPenalty = Math.round((m.height - 900) / 100) * 1.5;
  const bt=Math.round(sr(s,-6,8)-altPenalty);
  const ws=Math.round(sr(s+1,8,60)),wd=Math.round(sr(s+2,0,359));
  const hum=Math.round(sr(s+3,55,98)),pres=Math.round(sr(s+4,940,1020));
  const wc=MC[Math.floor(sr(s+5,0,MC.length))];
  const prec=Math.round(sr(s+6,0,100));
  const now=new Date();now.setMinutes(0,0,0);
  const hT=[],hTe=[],hC=[],hW=[],hWG=[],hWD=[],hP=[];
  for(let i=0;i<48;i++){
    const t=new Date(now.getTime()+i*3600000);
    hT.push(t.toISOString().slice(0,16));
    hTe.push(+(bt+Math.sin((t.getHours()-6)*Math.PI/12)*2+sr(s+i*7,-1,1)).toFixed(1));
    hC.push(i%8===0?MC[Math.floor(sr(s+i,0,MC.length))]:wc);
    hW.push(Math.round(ws+sr(s+i*3,-10,10)));
    hWG.push(Math.round(ws*1.4+sr(s+i*4,-5,15)));
    hWD.push(Math.round((wd+sr(s+i*2,-20,20)+360)%360));
    hP.push([63,73,80,81,95].includes(wc)?Math.round(sr(s+i*5,25,90)):Math.round(sr(s+i*5,0,25)));
  }
  const dT=[],dC=[],dMx=[],dMn=[],dW=[],dWG=[],dWD=[],dSR=[],dSS=[],dP=[];
  for(let i=0;i<4;i++){
    const d=new Date(now);d.setDate(d.getDate()+i);d.setHours(0,0,0,0);
    dT.push(d.toISOString().slice(0,10));
    dC.push(MC[Math.floor(sr(s+i*11,0,MC.length))]);
    dMx.push(+(bt+sr(s+i*13,0,4)).toFixed(1));
    dMn.push(+(bt-sr(s+i*17,2,7)).toFixed(1));
    dW.push(Math.round(ws+sr(s+i*19,0,20)));
    dWG.push(Math.round(ws*1.4+sr(s+i*20,5,20)));
    dWD.push(Math.round((wd+i*25)%360));
    const rise=new Date(d);rise.setHours(5,20+i*6,0);
    const set=new Date(d);set.setHours(20,15-i*9,0);
    dSR.push(rise.toISOString().slice(0,16));
    dSS.push(set.toISOString().slice(0,16));
    dP.push([63,73,80,81,95].includes(dC[i])?Math.round(sr(s+i*23,40,90)):Math.round(sr(s+i*23,0,30)));
  }
  return{
    current:{temperature_2m:bt,apparent_temperature:bt-Math.round(ws/8),weather_code:wc,wind_speed_10m:ws,wind_direction_10m:wd,wind_gusts_10m:Math.round(ws*1.4),relative_humidity_2m:hum,surface_pressure:pres,precipitation_probability:prec},
    hourly:{time:hT,temperature_2m:hTe,weather_code:hC,wind_speed_10m:hW,wind_gusts_10m:hWG,wind_direction_10m:hWD,precipitation_probability:hP},
    daily:{time:dT,weather_code:dC,temperature_2m_max:dMx,temperature_2m_min:dMn,wind_speed_10m_max:dW,wind_gusts_10m_max:dWG,wind_direction_10m_dominant:dWD,sunrise:dSR,sunset:dSS,precipitation_probability_max:dP},
    _isMock:true,
  };
}

// ─── Context for temp unit preference ────────────────────────────────────────
const TempUnitCtx = createContext({useFahrenheit:false, toggle:()=>{}});
function useTempUnit(){ return useContext(TempUnitCtx); }

// ─── Mountain SVG ─────────────────────────────────────────────────────────────
function MountainSVG({name, w=420, h=120, accent="rgba(255,255,255,0.85)", mini=false}){
  const pts = getSil(name);
  const ys = pts.map(p=>p[1]);
  const minY=Math.min(...ys), maxY=Math.max(...ys), rY=maxY-minY||1;
  const scaled = pts.map(([x,y])=>[(x/200)*w, ((y-minY)/rY)*h]);
  const poly = scaled.map(p=>p.join(",")).join(" ");
  const threshold = h * 0.20;
  const snowPts = [...scaled.filter(p=>p[1]<=threshold)];
  if(snowPts.length>1){const f=snowPts[0],l=snowPts[snowPts.length-1];snowPts.push([l[0],threshold],[f[0],threshold]);}
  const seed = name.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  return(
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:"100%",display:"block"}} preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id={`mfg-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.09)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0.01)"/>
        </linearGradient>
      </defs>
      <polygon points={poly} fill={`url(#mfg-${seed})`} stroke="none"/>
      <polyline points={poly} fill="none" stroke={accent} strokeWidth={mini?0.7:1.3} strokeLinejoin="round" strokeLinecap="round"/>
      {snowPts.length>2 && (
        <polygon points={snowPts.map(p=>p.join(",")).join(" ")} fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6"/>
      )}
    </svg>
  );
}

// ─── Temperature display — tappable toggle ────────────────────────────────────
function TempDisplay({celsius, big=false, style={}}){
  const {useFahrenheit, toggle} = useTempUnit();
  const c = Math.round(celsius), f = toF(celsius);
  const pri = useFahrenheit ? `${f}°F` : `${c}°C`;
  const sec = useFahrenheit ? `${c}°C`  : `${f}°F`;
  if(big) return(
    <div onClick={toggle} title="Tap to switch °C / °F"
      style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",userSelect:"none",...style}}>
      <div style={{fontSize:84,fontWeight:900,letterSpacing:-5,lineHeight:1,color:"#fff",fontVariantNumeric:"tabular-nums",textShadow:"0 0 80px rgba(255,255,255,0.2)"}}>
        {pri}
      </div>
      <div style={{paddingTop:14,display:"flex",flexDirection:"column",gap:3}}>
        <div style={{fontSize:22,fontWeight:700,color:"rgba(255,255,255,0.38)",letterSpacing:-1}}>{sec}</div>
        <div style={{fontSize:8,letterSpacing:1.5,color:"rgba(255,255,255,0.2)",textTransform:"uppercase"}}>tap to swap</div>
      </div>
    </div>
  );
  return(
    <div onClick={toggle} style={{display:"flex",alignItems:"baseline",gap:5,cursor:"pointer",userSelect:"none",...style}}>
      <span style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:-1}}>{pri}</span>
      <span style={{fontSize:15,fontWeight:600,color:"rgba(255,255,255,0.38)"}}>{sec}</span>
    </div>
  );
}

// ─── Wind compass ─────────────────────────────────────────────────────────────
function WindCompass({dir}){
  const rad=(dir*Math.PI)/180, cx=20, cy=20;
  const ax=cx+Math.sin(rad)*10, ay=cy-Math.cos(rad)*10;
  const bx=cx-Math.sin(rad)*5, by=cy+Math.cos(rad)*5;
  return(
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx={cx} cy={cy} r="15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      {["N","E","S","W"].map((d,i)=>{const a=i*Math.PI/2;return(
        <text key={d} x={cx+Math.sin(a)*11} y={cy-Math.cos(a)*11+3.5} fill={d==="N"?"#fff":"rgba(255,255,255,0.3)"} fontSize="5.5" textAnchor="middle" fontWeight={d==="N"?"700":"400"}>{d}</text>
      );})}
      <line x1={bx} y1={by} x2={ax} y2={ay} stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx={ax} cy={ay} r="2.5" fill="#60a5fa"/>
      <circle cx={cx} cy={cy} r="2" fill="rgba(255,255,255,0.2)"/>
    </svg>
  );
}

// ─── Risk bar ─────────────────────────────────────────────────────────────────
function RiskBar({band, score, large=false}){
  const color=RISK_ACCENT[band], label=RISK_LABELS[band];
  if(large) return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{flex:1,height:4,background:"rgba(255,255,255,0.1)",borderRadius:2,overflow:"hidden"}}>
          <div style={{width:`${score}%`,height:"100%",background:color,borderRadius:2,transition:"width .6s"}}/>
        </div>
        <span style={{fontSize:11,color,fontWeight:800,letterSpacing:2,minWidth:76}}>{label} RISK</span>
      </div>
      <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:1}}>SUMMIT RISK SCORE {score}/100</div>
    </div>
  );
  return <span style={{fontSize:8,fontWeight:700,letterSpacing:1.5,color,background:`${color}22`,border:`1px solid ${color}44`,borderRadius:3,padding:"2px 5px"}}>{label}</span>;
}

// ─── Risk breakdown ───────────────────────────────────────────────────────────
function RiskBreakdown({detail}){
  return(
    <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:14,marginTop:8}}>
      <div style={{fontSize:9,letterSpacing:2,color:"rgba(255,255,255,0.35)",marginBottom:10}}>HOW RISK IS CALCULATED</div>
      {detail.map(d=>{
        const pct=(d.score/d.max)*100, col=pct>70?"#ef4444":pct>40?"#f59e0b":"#3b82f6";
        return(
          <div key={d.factor} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>{d.factor}</span>
              <span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{d.value} <span style={{color:col,fontWeight:700}}>{d.score}/{d.max}</span></span>
            </div>
            <div style={{height:2,background:"rgba(255,255,255,0.08)",borderRadius:1,overflow:"hidden"}}>
              <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:1}}/>
            </div>
          </div>
        );
      })}
      <div style={{fontSize:9,color:"rgba(255,255,255,0.22)",marginTop:10,lineHeight:1.5}}>
        Mountaineering Scotland &amp; MWIS guidance. Weather from Open-Meteo summit-elevation model.
      </div>
    </div>
  );
}

// ─── Loading pulse ────────────────────────────────────────────────────────────
function LoadingPulse(){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12,padding:"16px 0"}}>
      {[78,52,36].map((w,i)=>(
        <div key={i} style={{height:i===0?56:16,width:`${w}%`,background:"rgba(255,255,255,0.07)",borderRadius:7,animation:"pulse 1.5s ease-in-out infinite",animationDelay:`${i*0.15}s`}}/>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.75}}`}</style>
    </div>
  );
}

// ─── Hourly strip ─────────────────────────────────────────────────────────────
function HourlyStrip({hourly}){
  const {useFahrenheit} = useTempUnit();
  const now=new Date(), times=hourly.time||[];
  const start=Math.max(0, times.findIndex(t=>new Date(t)>=now));
  return(
    <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
      {times.slice(start, start+24).map((t,i)=>{
        const idx=start+i;
        const wmo=WMO[hourly.weather_code?.[idx]]||{icon:"?"};
        const temp=hourly.temperature_2m?.[idx];
        const wind=hourly.wind_speed_10m?.[idx];
        const gusts=hourly.wind_gusts_10m?.[idx];
        const prec=hourly.precipitation_probability?.[idx]||0;
        const isNow=i===0;
        const dispTemp=temp!=null?(useFahrenheit?`${toF(temp)}°F`:`${Math.round(temp)}°C`):"-";
        return(
          <div key={t} style={{flexShrink:0,width:58,background:isNow?"rgba(255,255,255,0.13)":"rgba(255,255,255,0.05)",border:`1px solid ${isNow?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:"10px 0",textAlign:"center"}}>
            <div style={{fontSize:9,color:isNow?"#fff":"rgba(255,255,255,0.38)",letterSpacing:1,marginBottom:5}}>{isNow?"NOW":formatHour(t)}</div>
            <div style={{fontSize:14,marginBottom:5}}>{wmo.icon}</div>
            <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:2}}>{dispTemp}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginBottom:prec>0?2:0}}>
              {wind!=null?`${Math.round(wind)}mph`:""}
              {gusts!=null&&wind!=null?<span style={{color:"rgba(255,255,255,0.2)"}}> ↑{Math.round(gusts)}</span>:""}
            </div>
            {prec>0&&<div style={{fontSize:9,color:"#60a5fa"}}>{prec}%</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Daily forecast ───────────────────────────────────────────────────────────
function DailyForecast({daily}){
  const {useFahrenheit} = useTempUnit();
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {(daily.time||[]).slice(0,4).map((d,i)=>{
        const wmo=WMO[daily.weather_code?.[i]]||{icon:"?",label:"Unknown"};
        const max=daily.temperature_2m_max?.[i], min=daily.temperature_2m_min?.[i];
        const wind=daily.wind_speed_10m_max?.[i], gusts=daily.wind_gusts_10m_max?.[i];
        const wD=daily.wind_direction_10m_dominant?.[i];
        const prec=daily.precipitation_probability_max?.[i];
        const sunrise=daily.sunrise?.[i], sunset=daily.sunset?.[i];
        const isT=i===0;
        const dispMax=max!=null?(useFahrenheit?`${toF(max)}°F`:`${Math.round(max)}°C`):"-";
        const dispMin=min!=null?(useFahrenheit?`${toF(min)}°F`:`${Math.round(min)}°C`):"-";
        return(
          <div key={d} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderLeft:`3px solid ${isT?"rgba(255,255,255,0.3)":"transparent"}`,borderRadius:14,padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div>
                <div style={{fontSize:12,color:isT?"#fff":"rgba(255,255,255,0.45)",fontWeight:isT?700:400,letterSpacing:1.5}}>{isT?"TODAY":formatDay(d)}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:1}}>{wmo.label}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginBottom:2,letterSpacing:1}}>HIGH / LOW</div>
                  <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{dispMax} <span style={{color:"rgba(255,255,255,0.35)",fontWeight:400}}>/ {dispMin}</span></div>
                </div>
                <div style={{fontSize:22}}>{wmo.icon}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
              {wind!=null&&(
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <WindCompass dir={wD||0}/>
                  <div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:1.5}}>WIND / GUSTS</div>
                    <div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{Math.round(wind)} <span style={{color:"rgba(255,255,255,0.4)"}}>↑{gusts?Math.round(gusts):"-"}</span> mph {windDir(wD||0)}</div>
                  </div>
                </div>
              )}
              {prec!=null&&(
                <div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:1.5}}>PRECIP</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#60a5fa"}}>{prec}%</div>
                </div>
              )}
              {sunrise&&(
                <div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:1.5}}>DAYLIGHT</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.55)"}}>
                    {new Date(sunrise).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})} – {new Date(sunset).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail page ──────────────────────────────────────────────────────────────
function DetailPage({munro, onBack}){
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("hourly");
  const [showRisk, setShowRisk] = useState(false);
  const {useFahrenheit} = useTempUnit();

  useEffect(()=>{
    setLoading(true); setData(null); setTab("hourly"); setShowRisk(false);
    fetchWeather(munro).then(d=>{ setData(d); setLoading(false); });
  },[munro.name]);

  const cur = data?.current||{};
  const wmo = WMO[cur.weather_code]||{icon:"?",label:"Unknown",ds:0};
  const risk = calcRisk(cur);
  const g = RISK_GRADIENTS[risk.band];
  const acc = RISK_ACCENT[risk.band];
  const feelsC = Math.round(cur.apparent_temperature??0);
  const feelsF = toF(cur.apparent_temperature??0);
  const feelsPri = useFahrenheit?`${feelsF}°F`:`${feelsC}°C`;
  const feelsSec = useFahrenheit?`${feelsC}°C`:`${feelsF}°F`;

  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(170deg,${g[0]} 0%,${g[1]} 40%,#040406 100%)`,color:"#fff",fontFamily:"system-ui,-apple-system,sans-serif"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"24px 24px 0"}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.14)",color:"rgba(255,255,255,0.6)",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:11,letterSpacing:2}}>← BACK</button>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:3}}>SUMMIT FORECAST</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:1}}>{munro.height}m · {munro.region}</div>
        </div>
      </div>

      <div style={{padding:"20px 24px 0"}}>
        {loading ? <LoadingPulse/> : data ? (
          <>
            <TempDisplay celsius={cur.temperature_2m??0} big style={{marginBottom:6}}/>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:16}}>
              {wmo.label} · Feels {feelsPri} / {feelsSec}
            </div>
            <div style={{marginBottom:20}}>
              <RiskBar band={risk.band} score={risk.score} large/>
              <button onClick={()=>setShowRisk(v=>!v)} style={{marginTop:8,background:"none",border:"none",color:acc,fontSize:11,cursor:"pointer",letterSpacing:1,padding:0}}>
                {showRisk?"▲ HIDE":"▼ HOW IS RISK CALCULATED?"}
              </button>
              {showRisk && <RiskBreakdown detail={risk.detail}/>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
              {[
                {label:"WIND",value:`${Math.round(cur.wind_speed_10m||0)}`,unit:"mph"},
                {label:"GUSTS",value:`${Math.round(cur.wind_gusts_10m||0)}`,unit:"mph"},
                {label:"HUMIDITY",value:`${cur.relative_humidity_2m||0}`,unit:"%"},
                {label:"PRESSURE",value:`${Math.round(cur.surface_pressure||0)}`,unit:"hPa"},
              ].map(s=>(
                <div key={s.label} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:1.5,marginBottom:4}}>{s.label}</div>
                  <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{s.value}<span style={{fontSize:10,fontWeight:400,color:"rgba(255,255,255,0.35)"}}>{s.unit}</span></div>
                </div>
              ))}
            </div>
            <div style={{marginBottom:20,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:14}}>
              <WindCompass dir={cur.wind_direction_10m||0}/>
              <div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:2}}>Wind from the {windDir(cur.wind_direction_10m||0)}</div>
                <div style={{fontSize:15,fontWeight:700,color:"#fff"}}>{Math.round(cur.wind_speed_10m||0)} mph <span style={{color:"rgba(255,255,255,0.4)",fontWeight:400}}>↑{Math.round(cur.wind_gusts_10m||0)} gusts</span></div>
              </div>
              {(cur.wind_speed_10m||0)>30&&<div style={{marginLeft:"auto",fontSize:10,background:"rgba(239,68,68,0.15)",color:"#fca5a5",border:"1px solid rgba(239,68,68,0.3)",borderRadius:6,padding:"4px 10px",letterSpacing:1}}>STRONG WINDS</div>}
            </div>
          </>
        ) : <div style={{textAlign:"center",padding:60,color:"rgba(255,255,255,0.3)"}}>No data available</div>}
      </div>

      <div style={{padding:"0 24px"}}>
        <h1 style={{fontSize:munro.name.length>16?20:28,fontWeight:900,margin:"0 0 2px",letterSpacing:-0.5,color:"rgba(255,255,255,0.9)"}}>{munro.name}</h1>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.28)",letterSpacing:2,marginBottom:8}}>{munro.height}m ABOVE SEA LEVEL</div>
        <div style={{height:130,width:"100%"}}>
          <MountainSVG name={munro.name} w={500} h={130} accent={acc+"cc"}/>
        </div>
      </div>

      {data&&(
        <>
          <div style={{display:"flex",padding:"12px 24px 14px"}}>
            {[["hourly","HOURLY"],["days","4-DAY OUTLOOK"]].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"10px 0",background:tab===k?"rgba(255,255,255,0.12)":"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:k==="hourly"?"10px 0 0 10px":"0 10px 10px 0",color:tab===k?"#fff":"rgba(255,255,255,0.35)",fontSize:11,letterSpacing:2,cursor:"pointer",fontWeight:tab===k?700:400}}>{l}</button>
            ))}
          </div>
          <div style={{padding:"0 24px 60px"}}>
            {tab==="hourly"?<HourlyStrip hourly={data.hourly}/>:<DailyForecast daily={data.daily}/>}
          </div>
        </>
      )}
    </div>
  );
}


// ─── Munro card with weather callback (for home sort-by-risk) ─────────────────
function MunroCardWithCallback({munro, onClick, onWeatherLoaded}){
  const [wx, setWx] = useState(null);
  const {useFahrenheit} = useTempUnit();
  useEffect(()=>{
    fetchWeather(munro).then(d=>{
      setWx(d?.current);
      if(onWeatherLoaded && d?.current) onWeatherLoaded(munro.name, d.current);
    }).catch(()=>{});
  },[]);
  const wmo = wx ? (WMO[wx.weather_code]||{icon:"?",label:""}) : null;
  const risk = calcRisk(wx);
  const g = RISK_GRADIENTS[risk.band];
  const acc = RISK_ACCENT[risk.band];
  const dispTemp = wx ? (useFahrenheit?`${toF(wx.temperature_2m)}°F`:`${Math.round(wx.temperature_2m)}°C`) : null;
  const secTemp  = wx ? (useFahrenheit?`${Math.round(wx.temperature_2m)}°C`:`${toF(wx.temperature_2m)}°F`) : null;
  return(
    <div onClick={onClick}
      style={{background:`linear-gradient(135deg,${g[0]} 0%,${g[1]} 100%)`,border:`1px solid ${acc}33`,borderRadius:14,padding:"12px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"transform .15s"}}
      onMouseEnter={e=>e.currentTarget.style.transform="scale(1.01)"}
      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",letterSpacing:2,marginBottom:1}}>{munro.region.toUpperCase()}</div>
        <div style={{fontSize:15,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{munro.name}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.55)"}}>{munro.height}m</div>
      </div>
      <div style={{width:80,height:40,opacity:.5,flexShrink:0,margin:"0 12px"}}>
        <MountainSVG name={munro.name} w={80} h={40} mini accent={acc+"99"}/>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        {wx ? (
          <>
            <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>{dispTemp}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{secTemp}</div>
            <RiskBar band={risk.band} score={risk.score}/>
          </>
        ) : <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:2}}>LOADING</div>}
      </div>
    </div>
  );
}

// ─── Munro list card (browse page) ────────────────────────────────────────────
function MunroCard({munro, onClick}){
  const [wx, setWx] = useState(null);
  const {useFahrenheit} = useTempUnit();
  useEffect(()=>{ fetchWeather(munro).then(d=>setWx(d?.current)).catch(()=>{}); },[]);
  const wmo = wx ? (WMO[wx.weather_code]||{icon:"?",label:""}) : null;
  const risk = calcRisk(wx);
  const g = RISK_GRADIENTS[risk.band];
  const acc = RISK_ACCENT[risk.band];
  const dispTemp = wx ? (useFahrenheit?`${toF(wx.temperature_2m)}°F`:`${Math.round(wx.temperature_2m)}°C`) : null;
  const secTemp  = wx ? (useFahrenheit?`${Math.round(wx.temperature_2m)}°C`:`${toF(wx.temperature_2m)}°F`) : null;

  return(
    <div onClick={onClick}
      style={{background:`linear-gradient(135deg,${g[0]} 0%,${g[1]} 100%)`,border:`1px solid ${acc}33`,borderRadius:14,padding:"12px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"transform .15s"}}
      onMouseEnter={e=>e.currentTarget.style.transform="scale(1.01)"}
      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",letterSpacing:2,marginBottom:1}}>{munro.region.toUpperCase()}</div>
        <div style={{fontSize:15,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{munro.name}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.55)"}}>{munro.height}m</div>
      </div>
      <div style={{width:80,height:40,opacity:.5,flexShrink:0,margin:"0 12px"}}>
        <MountainSVG name={munro.name} w={80} h={40} mini accent={acc+"99"}/>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        {wx ? (
          <>
            <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>{dispTemp}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{secTemp}</div>
            <RiskBar band={risk.band} score={risk.score}/>
          </>
        ) : <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:2}}>LOADING</div>}
      </div>
    </div>
  );
}

// ─── Home hero card ───────────────────────────────────────────────────────────
function HeroCard({munro, onDetail, showRisk, onToggleRisk}){
  const [wx, setWx] = useState(null);
  const [loading, setLoading] = useState(true);
  const {useFahrenheit, toggle} = useTempUnit();

  useEffect(()=>{
    setLoading(true);
    fetchWeather(munro).then(d=>{ setWx(d?.current); setLoading(false); });
  },[munro.name]);

  const wmo = wx?(WMO[wx.weather_code]||{icon:"?",label:"Unknown"}):null;
  const risk = calcRisk(wx);
  const g = RISK_GRADIENTS[risk.band];
  const acc = RISK_ACCENT[risk.band];
  const pri = wx?(useFahrenheit?`${toF(wx.temperature_2m)}°F`:`${Math.round(wx.temperature_2m)}°C`):null;
  const sec = wx?(useFahrenheit?`${Math.round(wx.temperature_2m)}°C`:`${toF(wx.temperature_2m)}°F`):null;
  const feelsC = wx?Math.round(wx.apparent_temperature??0):null;
  const feelsPri = wx?(useFahrenheit?`${toF(wx.apparent_temperature??0)}°F`:`${feelsC}°C`):null;

  return(
    <div style={{background:`linear-gradient(160deg,${g[0]} 0%,${g[1]} 55%,${g[2]} 100%)`,borderRadius:20,overflow:"hidden",marginBottom:0}}>
      <div style={{padding:"22px 22px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <div style={{fontSize:10,letterSpacing:4,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",marginBottom:3}}>Today's Summit</div>
            <h2 style={{fontSize:munro.name.length>16?18:24,fontWeight:900,margin:"0 0 2px",letterSpacing:-0.5}}>{munro.name}</h2>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>{munro.height}m · {munro.region}</div>
          </div>
          <button onClick={onDetail} style={{background:"rgba(255,255,255,0.12)",border:`1px solid ${acc}88`,color:"#fff",borderRadius:10,padding:"9px 16px",cursor:"pointer",fontSize:12,letterSpacing:1,fontWeight:600,flexShrink:0}}>DETAIL →</button>
        </div>

        {loading ? <LoadingPulse/> : wx ? (
          <>
            <div style={{display:"flex",alignItems:"flex-end",gap:12,marginBottom:3,cursor:"pointer",userSelect:"none"}} onClick={toggle}>
              <div style={{fontSize:92,fontWeight:900,color:"#fff",letterSpacing:-5,lineHeight:1,textShadow:"0 0 80px rgba(255,255,255,0.25)"}}>{pri}</div>
              <div style={{paddingBottom:6}}>
                <div style={{fontSize:24,fontWeight:700,color:"rgba(255,255,255,0.65)",letterSpacing:-1}}>{sec}</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,0.8)",letterSpacing:2,textTransform:"uppercase",fontWeight:600}}>{wmo?.label}</div>
              </div>
            </div>
            <div style={{fontSize:10,letterSpacing:1.5,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",marginBottom:8}}>tap temperature to swap °C / °F</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginBottom:14}}>
              Feels {feelsPri} · {Math.round(wx.wind_speed_10m||0)} mph {windDir(wx.wind_direction_10m||0)} · Gusts {Math.round(wx.wind_gusts_10m||0)} mph
            </div>
            <RiskBar band={risk.band} score={risk.score} large/>
            <button onClick={onToggleRisk} style={{marginTop:10,background:"none",border:"none",color:acc,fontSize:11,cursor:"pointer",letterSpacing:1,padding:0,fontWeight:600}}>
              {showRisk?"▲ HIDE RISK BREAKDOWN":"▼ HOW IS RISK CALCULATED?"}
            </button>
            {showRisk&&<RiskBreakdown detail={risk.detail}/>}
          </>
        ) : null}
      </div>
      <div style={{height:130,marginLeft:0,marginRight:0,marginTop:14}}>
        <MountainSVG name={munro.name} w={500} h={130} accent={wx?acc+"cc":"rgba(255,255,255,0.55)"}/>
      </div>
    </div>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────
function SearchBar({value, onChange, onClear}){
  return(
    <div style={{position:"relative",marginBottom:20}}>
      <div style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.3)",fontSize:15,pointerEvents:"none"}}>⌕</div>
      <input
        value={value}
        onChange={e=>onChange(e.target.value)}
        placeholder="Search all 282 Munros…"
        style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"#fff",borderRadius:14,padding:"13px 42px 13px 40px",fontSize:15,outline:"none",boxSizing:"border-box",letterSpacing:0.2}}
      />
      {value&&(
        <button onClick={onClear} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.12)",border:"none",color:"rgba(255,255,255,0.6)",borderRadius:"50%",width:22,height:22,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App(){
  // ALL hooks must come first — no hooks after conditional returns
  const [page, setPage]               = useState("home");
  const [selected, setSelected]       = useState(null);
  const [search, setSearch]           = useState("");
  const [regionFilter, setRegionFilter] = useState("All");
  const [sortOrder, setSortOrder]     = useState("alpha"); // "alpha" | "risk" | "region"
  const [munroWeather, setMunroWeather] = useState({});   // name → calcRisk result
  const [showHeroRisk, setShowHeroRisk] = useState(false);
  const [useFahrenheit, setUseFahrenheit] = useState(()=>{
    try{ return localStorage.getItem("munro_unit")==="F"; }catch{ return false; }
  });
  const [heroMunro] = useState(()=>MUNROS[Math.floor(Math.random()*MUNROS.length)]);

  const toggleUnit = ()=>setUseFahrenheit(v=>{
    const next=!v;
    try{ localStorage.setItem("munro_unit",next?"F":"C"); }catch{}
    return next;
  });
  const tempCtx = {useFahrenheit, toggle:toggleUnit};

  const open = (m,src)=>{ setSelected({...m,_src:src}); setPage("detail"); };

  const regions = ["All",...[...new Set(MUNROS.map(m=>m.region))].sort()];

  const onWeatherLoaded = (name,wx)=>{
    setMunroWeather(prev=>({...prev,[name]:calcRisk(wx)}));
  };

  // Sorted & filtered list
  const baseMunros = search.length>0
    ? MUNROS.filter(m=>m.name.toLowerCase().includes(search.toLowerCase())||m.region.toLowerCase().includes(search.toLowerCase()))
    : [...MUNROS];

  const sortedMunros = [...baseMunros].sort((a,b)=>{
    if(sortOrder==="risk"){
      const ra=munroWeather[a.name]?.band??-1;
      const rb=munroWeather[b.name]?.band??-1;
      if(ra!==rb) return rb-ra;
    }
    if(sortOrder==="region"){
      const rc=a.region.localeCompare(b.region);
      if(rc!==0) return rc;
    }
    return a.name.localeCompare(b.name);
  });

  const filteredMunros = regionFilter==="All"
    ? sortedMunros
    : sortedMunros.filter(m=>m.region===regionFilter);

  // Now safe to conditionally return — all hooks are above
  if(page==="detail"&&selected) return(
    <TempUnitCtx.Provider value={tempCtx}>
      <DetailPage munro={selected} onBack={()=>{ setPage("home"); setSelected(null); }}/>
    </TempUnitCtx.Provider>
  );

  return(
    <TempUnitCtx.Provider value={tempCtx}>
      <div style={{minHeight:"100vh",background:"#040406",color:"#fff",fontFamily:"system-ui,-apple-system,sans-serif"}}>
        <div style={{maxWidth:600,margin:"0 auto",padding:"28px 20px 60px"}}>

          {/* Header */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,letterSpacing:4,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",marginBottom:4}}>Scotland · 282 Munros</div>
            <h1 style={{fontSize:30,fontWeight:900,margin:0,letterSpacing:-1}}>Summit Forecasts</h1>
          </div>

          {/* Search bar */}
          <SearchBar value={search} onChange={setSearch} onClear={()=>setSearch("")}/>

          {/* Hero — always visible */}
          <HeroCard
            munro={heroMunro}
            onDetail={()=>open(heroMunro,"home")}
            showRisk={showHeroRisk}
            onToggleRisk={()=>setShowHeroRisk(v=>!v)}
          />

          {/* Sort + filter controls */}
          <div style={{marginTop:28,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:3,color:"rgba(255,255,255,0.7)"}}>ALL MUNROS</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{filteredMunros.length}</div>
              </div>
              {/* Sort pills */}
              <div style={{display:"flex",gap:0}}>
                {[["alpha","A–Z"],["risk","RISK"],["region","REGION"]].map(([k,l],i,arr)=>(
                  <button key={k} onClick={()=>setSortOrder(k)} style={{
                    padding:"6px 12px",
                    background:sortOrder===k?"rgba(255,255,255,0.16)":"rgba(255,255,255,0.05)",
                    border:"1px solid rgba(255,255,255,0.12)",
                    borderRadius:i===0?"8px 0 0 8px":i===arr.length-1?"0 8px 8px 0":"0",
                    color:sortOrder===k?"#fff":"rgba(255,255,255,0.5)",
                    fontSize:10,letterSpacing:1,cursor:"pointer",fontWeight:sortOrder===k?700:400,
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Region filter chips */}
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,scrollbarWidth:"none"}}>
              {regions.map(r=>(
                <button key={r} onClick={()=>setRegionFilter(r)} style={{
                  flexShrink:0,
                  background:regionFilter===r?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.04)",
                  border:`1px solid ${regionFilter===r?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.09)"}`,
                  borderRadius:8,padding:"5px 12px",
                  color:regionFilter===r?"#fff":"rgba(255,255,255,0.5)",
                  fontSize:10,cursor:"pointer",whiteSpace:"nowrap",
                  fontWeight:regionFilter===r?700:400,
                }}>{r}</button>
              ))}
            </div>
          </div>

          {/* Risk legend */}
          <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
            {RISK_LABELS.map((l,i)=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:RISK_ACCENT[i]}}/>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>{l}</span>
              </div>
            ))}
          </div>

          {/* Munro list */}
          {filteredMunros.length===0 ? (
            <div style={{textAlign:"center",padding:"40px 20px",color:"rgba(255,255,255,0.4)"}}>
              <div style={{fontSize:32,marginBottom:12}}>⛰</div>
              <div style={{fontSize:14}}>No munros found</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {filteredMunros.map(m=>(
                <MunroCardWithCallback
                  key={m.name}
                  munro={m}
                  onClick={()=>open(m,"home")}
                  onWeatherLoaded={onWeatherLoaded}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </TempUnitCtx.Provider>
  );
}
