//+------------------------------------------------------------------+
//|                                            ZoneX_XAUUSD.mq5 |
//|                              ZoneX Bot — XAUUSD Institutional   |
//|                         FULL, COMPILE-CLEAN SINGLE FILE          |
//+------------------------------------------------------------------+
#property copyright "ZoneX Bot by @zonexowner"
#property version   "1.00"
#property description "ZoneX Bot — XAUUSD Institutional Algorithm by @zonexowner"
#property strict
#include <Trade/Trade.mqh>
CTrade trade;

// ------------------------ BASIC UTILS -----------------------------
double Pip() {
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   return _Point * ((digits == 3 || digits == 5) ? 10.0 : 1.0);
}

// ======================= INPUT PARAMETERS =========================
// === OPTIMIZED AI CONFIGURATION ===
input group "=== AI LEARNING SYSTEM (OPTIMIZED) ==="
input bool     UseAI_Level1            = true;           // Enable Basic AI Learning
input bool     UseAI_Level2            = false;          // Placeholder for advanced (not used here)
input double   AI_ConfidenceThreshold  = 0.75;           // 0.6-0.9
input int      AI_LearningPeriod       = 50;             // 30-200
input double   AI_LearningRate         = 0.02;           // 0.005-0.05
input bool     AI_UsePatternRecognition= true;
input bool     AI_UseMarketRegime      = true;
input int      AI_MaxMemorySize        = 300;            // 200-2000
input bool     AI_AdaptiveParameters   = true;
input bool     AI_SafeMode             = true;

// === GENETIC OPTIMIZATION (Phase 2 – disabled) ===
input group "=== GENETIC OPTIMIZATION (Phase 2) ==="
input bool     UseGeneticOptimization  = false;
input int      GA_PopulationSize       = 15;
input int      GA_Generations          = 30;
input double   GA_MutationRate         = 0.08;
input double   GA_CrossoverRate        = 0.70;
input int      GA_EliteSize            = 2;

// === TIME SERIES PREDICTION (Phase 2 – disabled) ===
input group "=== TIME SERIES PREDICTION (Phase 2) ==="
input bool     UseTimeSeries           = false;
input int      TS_LookbackPeriod       = 40;
input int      TS_PredictionHorizon    = 3;
input double   TS_ConfidenceRequired   = 0.75;

// === CORE TRADING INPUTS ===
input group "=== CORE SETTINGS ==="
input bool     UseFixedLot             = false;
input double   FixedLot                = 0.05;
input double   RiskPercent             = 0.50;          // fallback if dynamic risk disabled
input double   SL_Pips                 = 243.0;
input double   TP_Pips                 = 510.0;

// === INDICATORS ===
input group "=== INDICATORS ==="
input int      FastEMA                 = 42;
input int      SlowEMA                 = 29;
input int      RSI_Period              = 14;
input int      MACD_Fast               = 71;
input int      MACD_Slow               = 142;
input int      MACD_Signal             = 59;
input int      ATR_Period              = 14;
input double   Min_ATR                 = 0.0001;

// === MTF CONFLUENCE ===
input group "=== MULTI-TIMEFRAME ==="
input bool     UseMTFConfluence        = true;
input ENUM_TIMEFRAMES HTF_Primary      = PERIOD_H1;
input ENUM_TIMEFRAMES HTF_Secondary    = PERIOD_H4;
input double   MTF_MinConfluence       = 0.70;
input bool     RequireHTFTrend         = true;

// === DYNAMIC RISK ===
input group "=== DYNAMIC RISK ==="
input bool     UseDynamicRisk          = true;
input double   BaseRiskPercent         = 1.00;
input double   MinRiskPercent          = 0.20;
input double   MaxRiskPercent          = 2.50;
input int      PerformanceLookback     = 20;
input bool     UseVolatilityScaling    = true;
input bool     UseConfidenceScaling    = true;
input bool     UseDrawdownProtection_New = true;

// === MARKET FILTERS ===
input group "=== MARKET FILTERS ==="
input bool     UseMarketStructureFilter= true;
input int      StructureLookback       = 20;
input double   StructureMinBreak       = 15.0;
input bool     UseOrderFlowFilter      = true;
input int      OrderFlowPeriod         = 10;
input bool     UseVolumeConfirmation   = true;
input double   VolumeMultiplier        = 1.5;
input bool     UseSessionBias          = true;

// === ADDITIONAL SETTINGS ===
input group "=== ADDITIONAL ==="
input double   SL_ATR_Multiplier       = 1.25;
input double   RiskRewardRatio         = 1.5;
input bool     UseSmartClose           = true;
input double   SmartCloseStartPercent  = 1.0;
input double   SmartCloseLockPercent   = 0.4;
input bool     EnableGridTrading       = true;
input double   GridStepPips            = 25.0;
input bool     UseTrailingSL           = true;
input double   TrailStart              = 38.0;
input double   TrailStep               = 8.5;
input bool     UseBreakEven            = true;
input double   BreakEvenStartPips      = 20.0;
input double   BreakEvenOffsetPips     = 2.0;
input bool     UseTrendMemory          = true;
input int      TrendMemoryBars         = 5; // x M15 bars
input bool     UseTradeHourFilter      = true;
input int      TradeHourStart          = 8;
input int      TradeHourEnd            = 18;
input int      MaxTotalOrders          = 10;
input int      MaxClusterPositions     = 4;
input int      EntryCooldownMinutes    = 10;
input bool     UseRegimeFilter         = true;
input bool     OnlyTradeStrongRegimes  = true;
input bool     UseOptimalTiming        = true;
input bool     AvoidNewsImpact         = true;
input bool     UseCorrelationFilter    = true;
input double   MaxDailyRisk            = 3.0;
input bool     UseVWAPFilter           = true;

// === HARD-CODED LICENSE (skip in tester) ===
#define ZONEX_LICENSED_ACCOUNT  25356015
#define ZONEX_LICENSE_EXPIRY    "2026.10.20"

// ========================= DASHBOARD UI (ZoneX institutional) =====================
#define DASH_PREFIX "ZoneX_"

#define ONYX_BG           C'15,15,15'
#define ONYX_LINE         C'40,40,40'
#define ONYX_MUTED        C'160,160,160'
#define ONYX_ROW          C'200,200,200'
#define ONYX_WARN         C'255,180,0'
#define ONYX_BORDER       C'0,200,100'
#define ONYX_ACCENT       C'0,230,110'
#define ONYX_TEXT         C'220,220,220'
#define ONYX_TEXT_DIM     C'140,140,140'
#define ONYX_LOSS         C'255,80,80'

input group "=== DASHBOARD ==="
input bool     ShowDashboard          = true;
input string   InpDashboardBotName    = "ZoneX Bot";
input string   InpDashboardDeveloper  = "@zonexowner";
input int      DashboardUpdateTicks   = 100;   // ticks between history/win-rate refresh
input bool     DashboardFilterByMagic = true;
input int      DashboardCornerX       = 10;
input int      DashboardCornerY       = 10;

int      g_dashHistoryTick        = 0;
string   g_dashCacheKey           = "";
double   g_dashFloatingPL         = 0.0;
int      g_dashOpenPositions      = 0;
int      g_dashCachedDayWins      = 0;
int      g_dashCachedDayTotal     = 0;
datetime g_dashDayAnchor          = 0;
double   g_dashDayStartEquity     = 0.0;
datetime g_dashSessionStart       = 0;
double   g_dashSessionStartEquity = 0.0;
double   g_dashPeakEquity         = 0.0;
double   g_dashMaxDrawdownPct     = 0.0;

// Set in OnInit from inputs declared below.
int      g_zonexMagic             = 882882;
string   g_dashSymbol             = "";

string DashChartSymbol()
  {
   if(g_dashSymbol != "")
      return g_dashSymbol;
   return _Symbol;
  }

bool DashMatchesMagic(const long magic, const string comment = "")
  {
   if(!DashboardFilterByMagic)
      return true;
   if((int)magic == g_zonexMagic)
      return true;
   if(StringFind(comment, "AI_") == 0)
      return true;
   return false;
  }

bool DashObjectExists(const string name)
  {
   return (ObjectFind(0, name) >= 0);
  }

void DashCreateLabel(const string name, const string text, const int x, const int y,
                     const int fontSize, const color textColor, const bool bold = false)
  {
   if(!DashObjectExists(name))
     {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, false);
     }
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetString(0, name, OBJPROP_FONT, bold ? "Consolas" : "Consolas");
   ObjectSetInteger(0, name, OBJPROP_COLOR, textColor);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
  }

void DashEnsureSeparator(const int px, const int py)
  {
   const string lineName = DASH_PREFIX "Line";
   if(!DashObjectExists(lineName))
     {
      ObjectCreate(0, lineName, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, lineName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, lineName, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, lineName, OBJPROP_HIDDEN, false);
     }
   ObjectSetInteger(0, lineName, OBJPROP_XDISTANCE, px + 15);
   ObjectSetInteger(0, lineName, OBJPROP_YDISTANCE, py + 54);
   ObjectSetInteger(0, lineName, OBJPROP_XSIZE, 310);
   ObjectSetInteger(0, lineName, OBJPROP_YSIZE, 1);
   ObjectSetInteger(0, lineName, OBJPROP_BGCOLOR, ONYX_LINE);
   ObjectSetInteger(0, lineName, OBJPROP_BORDER_TYPE, BORDER_FLAT);
  }

datetime DashDayStartTime()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   dt.hour = 0;
   dt.min  = 0;
   dt.sec  = 0;
   return StructToTime(dt);
  }

datetime DashSessionStartTime()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   dt.hour = TradeHourStart;
   dt.min  = 0;
   dt.sec  = 0;
   datetime sessionStart = StructToTime(dt);
   if(sessionStart > TimeCurrent())
      sessionStart -= 86400;
   return sessionStart;
  }

void DashResetAnchorsIfNeeded()
  {
   const datetime dayStart = DashDayStartTime();
   if(g_dashDayAnchor != dayStart)
     {
      g_dashDayAnchor      = dayStart;
      g_dashDayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      g_dashPeakEquity     = g_dashDayStartEquity;
      g_dashMaxDrawdownPct = 0.0;
     }

   const datetime sessionStart = DashSessionStartTime();
   if(g_dashSessionStart != sessionStart)
     {
      g_dashSessionStart        = sessionStart;
      g_dashSessionStartEquity  = AccountInfoDouble(ACCOUNT_EQUITY);
     }

   const double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(equity > g_dashPeakEquity)
      g_dashPeakEquity = equity;
  }

bool DashIsOurDeal(const ulong ticket)
  {
   if(ticket == 0)
      return false;
   if(!HistoryDealSelect(ticket))
      return false;

   const string dealSym = HistoryDealGetString(ticket, DEAL_SYMBOL);
   if(dealSym != DashChartSymbol())
      return false;

   const long   magic   = HistoryDealGetInteger(ticket, DEAL_MAGIC);
   const string comment = HistoryDealGetString(ticket, DEAL_COMMENT);
   return DashMatchesMagic(magic, comment);
  }

void DashCountClosedTrades(const datetime fromTime, const datetime toTime,
                           int &wins, int &losses, int &total)
  {
   wins = 0;
   losses = 0;
   total = 0;
   if(!HistorySelect(fromTime, TimeCurrent()))
      return;

   const int deals = HistoryDealsTotal();
   for(int i = deals - 1; i >= 0; i--)
     {
      const ulong ticket = HistoryDealGetTicket(i);
      if(!DashIsOurDeal(ticket))
         continue;
      if((long)HistoryDealGetInteger(ticket, DEAL_ENTRY) != DEAL_ENTRY_OUT)
         continue;

      const double pl = HistoryDealGetDouble(ticket, DEAL_PROFIT)
                      + HistoryDealGetDouble(ticket, DEAL_SWAP)
                      + HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      total++;
      if(pl > 0.0)
         wins++;
      else if(pl < 0.0)
         losses++;
     }
  }

string DashFormatMoney(const double value)
  {
   return ((value >= 0.0) ? "+" : "") + DoubleToString(value, 2);
  }

string DashDrawdownBar(const double ddPct, const int segments = 12)
  {
   const int filled = (int)MathRound(MathMin((double)segments, ddPct / 2.0));
   string bar = "[";
   for(int i = 0; i < segments; i++)
      bar += (i < filled) ? "#" : ".";
   bar += "]";
   return bar;
  }

void DashInitTracking()
  {
   g_dashDayAnchor           = DashDayStartTime();
   g_dashDayStartEquity      = AccountInfoDouble(ACCOUNT_EQUITY);
   g_dashSessionStart        = DashSessionStartTime();
   g_dashSessionStartEquity  = AccountInfoDouble(ACCOUNT_EQUITY);
   g_dashPeakEquity          = g_dashDayStartEquity;
   g_dashMaxDrawdownPct      = 0.0;
  }

void CreateDashboard()
  {
   if(!ShowDashboard)
      return;

   const int px = DashboardCornerX;
   const int py = DashboardCornerY;
   const string panelBg = DASH_PREFIX "Bg";

   if(!DashObjectExists(panelBg))
     {
      ObjectCreate(0, panelBg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, panelBg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, panelBg, OBJPROP_XDISTANCE, px);
      ObjectSetInteger(0, panelBg, OBJPROP_YDISTANCE, py);
      ObjectSetInteger(0, panelBg, OBJPROP_XSIZE, 340);
      ObjectSetInteger(0, panelBg, OBJPROP_YSIZE, 248);
      ObjectSetInteger(0, panelBg, OBJPROP_BGCOLOR, ONYX_BG);
      ObjectSetInteger(0, panelBg, OBJPROP_COLOR, ONYX_BORDER);
      ObjectSetInteger(0, panelBg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, panelBg, OBJPROP_WIDTH, 2);
      ObjectSetInteger(0, panelBg, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, panelBg, OBJPROP_HIDDEN, false);
     }

   DashEnsureSeparator(px, py);

   const string ddTrack = DASH_PREFIX "DD_Track";
   if(!DashObjectExists(ddTrack))
     {
      ObjectCreate(0, ddTrack, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, ddTrack, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, ddTrack, OBJPROP_XDISTANCE, px + 15);
      ObjectSetInteger(0, ddTrack, OBJPROP_YDISTANCE, py + 228);
      ObjectSetInteger(0, ddTrack, OBJPROP_XSIZE, 310);
      ObjectSetInteger(0, ddTrack, OBJPROP_YSIZE, 5);
      ObjectSetInteger(0, ddTrack, OBJPROP_BGCOLOR, ONYX_LINE);
      ObjectSetInteger(0, ddTrack, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, ddTrack, OBJPROP_SELECTABLE, false);
     }

   const string ddFill = DASH_PREFIX "DD_Fill";
   if(!DashObjectExists(ddFill))
     {
      ObjectCreate(0, ddFill, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, ddFill, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, ddFill, OBJPROP_XDISTANCE, px + 15);
      ObjectSetInteger(0, ddFill, OBJPROP_YDISTANCE, py + 228);
      ObjectSetInteger(0, ddFill, OBJPROP_XSIZE, 1);
      ObjectSetInteger(0, ddFill, OBJPROP_YSIZE, 5);
      ObjectSetInteger(0, ddFill, OBJPROP_BGCOLOR, ONYX_ACCENT);
      ObjectSetInteger(0, ddFill, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, ddFill, OBJPROP_SELECTABLE, false);
     }
  }

void DashCollectOpenPositions(double &totalProfit, int &totalPositions)
  {
   totalProfit     = 0.0;
   totalPositions  = 0;
   const string chartSym = DashChartSymbol();

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      const ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(!PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != chartSym)
         continue;

      const long magic = PositionGetInteger(POSITION_MAGIC);
      if(DashboardFilterByMagic)
        {
         if((int)magic != g_zonexMagic)
           {
            const string comment = PositionGetString(POSITION_COMMENT);
            if(StringFind(comment, "AI_") != 0)
               continue;
           }
        }

      totalProfit += PositionGetDouble(POSITION_PROFIT)
                   + PositionGetDouble(POSITION_SWAP);
      totalPositions++;
     }

   g_dashFloatingPL    = totalProfit;
   g_dashOpenPositions = totalPositions;
  }

double DashCurrentRiskPercent()
  {
   if(UseDynamicRisk && lastRiskCalc.finalRisk > 0.0)
      return lastRiskCalc.finalRisk;
   if(UseFixedLot)
      return RiskPercent;
   return BaseRiskPercent;
  }

void DashCountConfirmations(const double emaFast, const double emaSlow, const double rsi,
                            const double macdMain, const double macdSignal, const double atr,
                            const double vwap, int &current, int &total, string &readyHint)
  {
   current   = 0;
   total     = 0;
   readyHint = "";

   const bool buyBias = (emaFast >= emaSlow);
   const string dir   = buyBias ? "BUY" : "SELL";

   total++;
   if(buyBias && emaFast > emaSlow)
      current++;
   else if(!buyBias && emaFast < emaSlow)
      current++;

   total++;
   if(buyBias && rsi < 55.0)
      current++;
   else if(!buyBias && rsi > 45.0)
      current++;

   total++;
   if(buyBias && macdMain > macdSignal)
      current++;
   else if(!buyBias && macdMain < macdSignal)
      current++;

   total++;
   if(atr > Min_ATR)
      current++;

   if(UseMTFConfluence)
     {
      total++;
      const ConfluenceAnalysis conf = AnalyzeMTFConfluence();
      if(buyBias)
        {
         if(conf.overallScore >= MTF_MinConfluence &&
            (!RequireHTFTrend || conf.trendDirection == "BULLISH"))
            current++;
        }
      else
        {
         if(conf.overallScore >= MTF_MinConfluence &&
            (!RequireHTFTrend || conf.trendDirection == "BEARISH"))
            current++;
        }
     }

   int filtTotal = 0;
   int filtPass  = 0;
   if(UseMarketStructureFilter) { filtTotal++; if(ConfirmMarketStructure(dir)) filtPass++; }
   if(UseOrderFlowFilter)       { filtTotal++; if(ConfirmOrderFlow(dir))       filtPass++; }
   if(UseVolumeConfirmation)    { filtTotal++; if(ConfirmVolume())            filtPass++; }
   if(UseSessionBias)           { filtTotal++; if(ConfirmSessionBias(dir))    filtPass++; }

   if(filtTotal > 0)
     {
      total++;
      if((double)filtPass / (double)filtTotal >= 0.6)
         current++;
     }

   if(UseVWAPFilter && vwapAvailable)
     {
      total++;
      if(buyBias)
        {
         const double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         if(bid < vwap - (20.0 * Pip()))
            current++;
        }
      else
        {
         const double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         if(ask > vwap + (20.0 * Pip()))
            current++;
        }
     }

   if(UseAI_Level1 && aiInitialized)
     {
      total++;
      const bool aiOk = (lastAIDecision.confidence >= adaptiveParams.currentConfidenceThreshold);
      if(buyBias  && aiOk && lastAIDecision.action == "BUY")
         current++;
      if(!buyBias && aiOk && lastAIDecision.action == "SELL")
         current++;
     }

   if(total > 0 && current == total)
      readyHint = (buyBias ? " (BUY READY)" : " (SELL READY)");
  }

void DashUpdateDrawdownMeter(const double ddPct)
  {
   const int trackWidth = 310;
   const int fillWidth  = (int)MathRound(MathMin((double)trackWidth, ddPct / 20.0 * (double)trackWidth));
   color fillClr = ONYX_ACCENT;
   if(ddPct >= 10.0)
      fillClr = ONYX_LOSS;
   else if(ddPct >= 5.0)
      fillClr = C'255,180,60';

   if(DashObjectExists(DASH_PREFIX "DD_Fill"))
     {
      ObjectSetInteger(0, DASH_PREFIX "DD_Fill", OBJPROP_XSIZE, MathMax(1, fillWidth));
      ObjectSetInteger(0, DASH_PREFIX "DD_Fill", OBJPROP_BGCOLOR, fillClr);
     }
  }

void UpdateDashboard()
  {
   if(!ShowDashboard)
      return;

   if(g_dashDayAnchor == 0)
      DashInitTracking();

   DashResetAnchorsIfNeeded();
   UpdateMarketState();

   double floating = 0.0;
   int    orders   = 0;
   DashCollectOpenPositions(floating, orders);

   const double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   const double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   const double dailyPL  = equity - g_dashDayStartEquity;
   const double sessionPL = equity - g_dashSessionStartEquity;

   g_dashHistoryTick++;
   const bool refreshHistory = (g_dashHistoryTick >= DashboardUpdateTicks);
   if(refreshHistory)
     {
      g_dashHistoryTick = 0;
      int dayWins = 0, dayLosses = 0, dayTotal = 0;
      DashCountClosedTrades(g_dashDayAnchor, TimeCurrent(), dayWins, dayLosses, dayTotal);
      g_dashCachedDayWins  = dayWins;
      g_dashCachedDayTotal = dayTotal;
     }

   double ddPct = 0.0;
   if(g_dashPeakEquity > 0.0)
     {
      ddPct = (g_dashPeakEquity - equity) / g_dashPeakEquity * 100.0;
      if(ddPct > g_dashMaxDrawdownPct)
         g_dashMaxDrawdownPct = ddPct;
     }
   DashUpdateDrawdownMeter(ddPct);

   if(!DashObjectExists(DASH_PREFIX "Bg"))
      CreateDashboard();

   const int px = DashboardCornerX;
   const int py = DashboardCornerY;
   const int Lx = px + 15;
   const int Rx = px + 190;
   const int y1 = py + 66;
   const int y2 = y1 + 22;
   const int y3 = y2 + 22;
   const int y4 = y3 + 22;
   const int y5 = y4 + 22;
   const int y6 = y5 + 22;

   const string accountNo = IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN));

   DashCreateLabel(DASH_PREFIX "Title", InpDashboardBotName, Lx, py + 10, 12, ONYX_ACCENT, true);
   DashCreateLabel(DASH_PREFIX "Dev", "by " + InpDashboardDeveloper + "  #" + accountNo, Lx, py + 32, 9, ONYX_MUTED, false);

   const color dailyClr  = (dailyPL >= 0.0) ? ONYX_ACCENT : ONYX_LOSS;
   const color sessClr   = (sessionPL >= 0.0) ? ONYX_ACCENT : ONYX_LOSS;
   const color floatClr  = (floating >= 0.0) ? ONYX_ACCENT : ONYX_LOSS;

   DashCreateLabel(DASH_PREFIX "DailyPL", "Daily P/L: " + DashFormatMoney(dailyPL), Lx, y1, 9, dailyClr, false);
   DashCreateLabel(DASH_PREFIX "Balance", "Balance: " + DoubleToString(balance, 2), Rx, y1, 9, ONYX_ROW, false);

   DashCreateLabel(DASH_PREFIX "Session", "Session: " + DashFormatMoney(sessionPL), Lx, y2, 9, sessClr, false);
   DashCreateLabel(DASH_PREFIX "Equity", "Equity: " + DoubleToString(equity, 2), Rx, y2, 9, ONYX_ROW, false);

   DashCreateLabel(DASH_PREFIX "Floating", "Floating: " + DashFormatMoney(floating), Lx, y3, 9, floatClr, false);
   DashCreateLabel(DASH_PREFIX "Positions", "Positions: " + IntegerToString(orders), Rx, y3, 9, ONYX_ROW, false);

   const double winRate = (g_dashCachedDayTotal > 0)
      ? ((double)g_dashCachedDayWins / (double)g_dashCachedDayTotal * 100.0)
      : riskMetrics.recentWinRate;
   DashCreateLabel(DASH_PREFIX "WinRate",
                   "Win: " + IntegerToString(g_dashCachedDayWins) + "/" + IntegerToString(g_dashCachedDayTotal)
                   + " (" + DoubleToString(winRate, 1) + "%)", Lx, y4, 9, ONYX_ROW, false);
   DashCreateLabel(DASH_PREFIX "Risk",
                   "Risk: " + DoubleToString(DashCurrentRiskPercent(), 2) + "%  "
                   + DoubleToString(dailyRiskUsed, 2) + "/" + DoubleToString(MaxDailyRisk, 2) + "%",
                   Rx, y4, 9, ONYX_ROW, false);

   DashCreateLabel(DASH_PREFIX "Drawdown",
                   "DD: " + DoubleToString(ddPct, 2) + "%  Max: " + DoubleToString(g_dashMaxDrawdownPct, 2) + "%  "
                   + DashDrawdownBar(ddPct), Lx, y5, 9, ONYX_TEXT_DIM, false);

   double emaFast = 0.0, emaSlow = 0.0, rsi = 0.0, atr = 0.0, vwap = 0.0;
   double macdMain = 0.0, macdSignal = 0.0;
   if(handleEMA_Fast != INVALID_HANDLE)
      emaFast = GetValue(handleEMA_Fast);
   if(handleEMA_Slow != INVALID_HANDLE)
      emaSlow = GetValue(handleEMA_Slow);
   if(handleRSI != INVALID_HANDLE)
      rsi = GetValue(handleRSI);
   if(handleATR != INVALID_HANDLE)
      atr = GetValue(handleATR);
   if(UseVWAPFilter && vwapAvailable && handleVWAP != INVALID_HANDLE)
      vwap = GetValue(handleVWAP);
   GetMACD(handleMACD, macdMain, macdSignal);

   int confCur = 0, confTot = 0;
   string readyHint = "";
   DashCountConfirmations(emaFast, emaSlow, rsi, macdMain, macdSignal, atr, vwap,
                          confCur, confTot, readyHint);

   color confClr = ONYX_WARN;
   if(confTot > 0 && confCur == confTot)
      confClr = ONYX_ACCENT;
   string confText = "Signals: " + IntegerToString(confCur) + " / " + IntegerToString(confTot) + readyHint;
   DashCreateLabel(DASH_PREFIX "Conf", confText, Lx, y6, 10, confClr, true);

   const double mtfScore = currentConfluence.overallScore;
   const string regimeLine = "Regime: " + marketState.regime + "/" + marketState.bias
                           + "  MTF: " + DoubleToString(mtfScore * 100.0, 1) + "%";
   DashCreateLabel(DASH_PREFIX "Regime", regimeLine, Lx, y6 + 20, 9, ONYX_TEXT_DIM, false);

   ChartRedraw(0);
  }

void DeleteDashboard()
  {
   Comment("");
   ObjectsDeleteAll(0, DASH_PREFIX);
   g_dashCacheKey         = "";
   g_dashHistoryTick      = 0;
   g_dashFloatingPL       = 0.0;
   g_dashOpenPositions    = 0;
   g_dashCachedDayWins    = 0;
   g_dashCachedDayTotal   = 0;
   g_dashDayAnchor        = 0;
   g_dashDayStartEquity   = 0.0;
   g_dashSessionStart     = 0;
   g_dashSessionStartEquity = 0.0;
   g_dashPeakEquity       = 0.0;
   g_dashMaxDrawdownPct   = 0.0;
   ChartRedraw(0);
  }

input group "=== SYSTEM ==="
input string   TradeSymbol             = "";
input int      MagicNumber             = 882882;  // ZoneX Bot default magic

// ====================== DATA STRUCTURES ===========================
struct AIPattern {
  double   indicators[15];
  double   marketState[5];
  string   outcome;
  double   profitLoss;
  datetime timestamp;
  double   confidence;
  int      occurrences;
  double   importance;
  
  AIPattern() {
    ArrayInitialize(indicators, 0.0);
    ArrayInitialize(marketState, 0.0);
    outcome="UNKNOWN"; profitLoss=0.0; timestamp=0;
    confidence=0.0; occurrences=1; importance=1.0;
  }
  
  AIPattern(const AIPattern &other) {
    ArrayCopy(indicators, other.indicators);
    ArrayCopy(marketState, other.marketState);
    outcome = other.outcome;
    profitLoss = other.profitLoss;
    timestamp = other.timestamp;
    confidence = other.confidence;
    occurrences = other.occurrences;
    importance = other.importance;
  }
};

struct AIDecision {
  string action;         // BUY/SELL/HOLD
  double confidence;     // 0..1
  double expectedReturn; // abstract score
  string reasoning;
  double riskScore;      // 0..1
  double qualityScore;   // 0..1
  
  AIDecision() {
    action="HOLD"; confidence=0.0; expectedReturn=0.0; reasoning="No pattern match";
    riskScore=0.5; qualityScore=0.0;
  }
  
  AIDecision(const AIDecision &other) {
    action = other.action;
    confidence = other.confidence;
    expectedReturn = other.expectedReturn;
    reasoning = other.reasoning;
    riskScore = other.riskScore;
    qualityScore = other.qualityScore;
  }
};

struct NeuralWeights {
  double inputWeights[15][10];
  double hiddenWeights[10][3];
  double hiddenBias[10];
  double outputBias[3];
  double momentum[15][10];
  double hiddenMomentum[10][3];
  
  NeuralWeights() {
    for(int i=0;i<15;i++){
      for(int j=0;j<10;j++){
        inputWeights[i][j]=(MathRand()/32767.0-0.5)*0.1;
        momentum[i][j]=0.0;
      }
    }
    for(int i=0;i<10;i++){
      hiddenBias[i]=(MathRand()/32767.0-0.5)*0.1;
      for(int j=0;j<3;j++){
        hiddenWeights[i][j]=(MathRand()/32767.0-0.5)*0.1;
        hiddenMomentum[i][j]=0.0;
      }
    }
    for(int i=0;i<3;i++) outputBias[i]=(MathRand()/32767.0-0.5)*0.1;
  }
};

struct GeneticIndividual {
  double parameters[20];
  double fitness;
  int    trades;
  double winRate;
  double profitFactor;
  double maxDrawdown;
  double sharpeRatio;
  
  GeneticIndividual() {
    ArrayInitialize(parameters,0.0);
    fitness=0.0; trades=0; winRate=0.0; profitFactor=1.0; maxDrawdown=0.0; sharpeRatio=0.0;
  }
};

struct AdaptiveParameters {
  double   currentConfidenceThreshold;
  int      currentLearningPeriod;
  double   currentLearningRate;
  int      currentMemorySize;
  datetime lastUpdate;
  double   performanceScore;
  
  AdaptiveParameters() {
    currentConfidenceThreshold = AI_ConfidenceThreshold;
    currentLearningPeriod      = AI_LearningPeriod;
    currentLearningRate        = AI_LearningRate;
    currentMemorySize          = AI_MaxMemorySize;
    lastUpdate=0; performanceScore=0.5;
  }
};

struct MTFSignal {
  ENUM_TIMEFRAMES timeframe;
  double trendStrength;    // -1..1 (sign = direction)
  double momentum;
  double volatility;
  double support_resistance;
  bool   isValid;
  
  MTFSignal() {
    timeframe=PERIOD_CURRENT; trendStrength=0.0; momentum=0.0; volatility=0.0;
    support_resistance=0.0; isValid=false;
  }
};

struct ConfluenceAnalysis {
  double overallScore;       // 0..1
  string trendDirection;     // BULLISH/BEARISH/NEUTRAL
  double trendStrength;      // 0..1
  MTFSignal timeframes[3];
  bool   highConfidence;
  
  ConfluenceAnalysis() { 
    overallScore=0.0; trendDirection="NEUTRAL"; trendStrength=0.0; highConfidence=false; 
  }
  
  ConfluenceAnalysis(const ConfluenceAnalysis &other) {
    overallScore = other.overallScore;
    trendDirection = other.trendDirection;
    trendStrength = other.trendStrength;
    for(int i=0; i<3; i++) {
      timeframes[i] = other.timeframes[i];
    }
    highConfidence = other.highConfidence;
  }
};

struct RiskMetrics {
  double recentWinRate;
  double avgProfit;
  double avgLoss;
  double consecutiveLosses;
  double maxDrawdown;
  double volatilityFactor;
  double confidenceFactor;
  
  RiskMetrics() {
    recentWinRate=50.0; avgProfit=0.0; avgLoss=0.0; consecutiveLosses=0.0;
    maxDrawdown=0.0; volatilityFactor=1.0; confidenceFactor=1.0;
  }
};

struct DynamicRiskCalculation {
  double finalRisk;
  double baseRisk;
  double performanceMultiplier;
  double volatilityMultiplier;
  double confidenceMultiplier;
  double drawdownReduction;
  string reasoning;
  
  DynamicRiskCalculation() {
    finalRisk=1.0; baseRisk=1.0; performanceMultiplier=1.0; volatilityMultiplier=1.0;
    confidenceMultiplier=1.0; drawdownReduction=1.0; reasoning="Base risk";
  }
  
  DynamicRiskCalculation(const DynamicRiskCalculation &other) {
    finalRisk = other.finalRisk;
    baseRisk = other.baseRisk;
    performanceMultiplier = other.performanceMultiplier;
    volatilityMultiplier = other.volatilityMultiplier;
    confidenceMultiplier = other.confidenceMultiplier;
    drawdownReduction = other.drawdownReduction;
    reasoning = other.reasoning;
  }
};

struct TradeMetrics {
  double winRate, avgWin, avgLoss, profitFactor;
  int    totalTrades;
  double maxDD, consistency;
};

struct MarketState {
  string regime;    // UPTREND/DOWNTREND/RANGE
  double strength;  // 0..1
  string bias;      // BULLISH/BEARISH/NEUTRAL
  double volatility;
  bool   newsImpact;
  string session;
};

// ========================= GLOBALS ================================
int handleEMA_Fast, handleEMA_Slow, handleRSI, handleMACD, handleATR, handleVWAP;
int handleEMA_Fast_H1, handleEMA_Slow_H1, handleRSI_H1, handleMACD_H1, handleATR_H1;
int handleEMA_Fast_H4, handleEMA_Slow_H4, handleRSI_H4, handleMACD_H4, handleATR_H4;

datetime lastEntryTime        = 0;
datetime trendLockStartTime   = 0;
string   trendLockedDirection = "";
double   maxEquityInCycle     = 0.0;
double   DisplayLot           = 0.10;
double   dynamicRiskPercent   = RiskPercent;
double   dailyRiskUsed        = 0.0;
datetime lastDayReset         = 0;
bool     vwapAvailable        = true;

MTFSignal              mtfSignals[3];
ConfluenceAnalysis     currentConfluence;
RiskMetrics            riskMetrics;
DynamicRiskCalculation lastRiskCalc;

double recentTrades[100];
int    recentTradeIndex = 0;
int    totalRecentTrades= 0;
TradeMetrics metrics;
MarketState  marketState;

// AI globals
AIPattern      aiPatterns[];
NeuralWeights  neuralNetwork;
AIDecision     lastAIDecision;
GeneticIndividual population[];
AdaptiveParameters adaptiveParams;

int     aiPatternCount   = 0;
int     aiTradeCount     = 0;
double  aiLearningHistory[];
int     learningIndex    = 0;
bool    aiInitialized    = false;
double  aiPerformanceScore = 0.0;

int     aiWinningTrades  = 0;
int     aiLosingTrades   = 0;
double  aiTotalProfit    = 0.0;
double  aiTotalLoss      = 0.0;
datetime lastAIOptimization = 0;

// ===================== FORWARD DECLARATIONS =======================
bool InitializeMTFIndicators();
bool InitializeAISystem();
void InitializeMetrics();

double GetValue(int handle);
bool   GetMACD(int handle, double &main, double &signal);
bool   IsNewCandle(string symbol);

void   UpdateMarketState();
string GetCurrentSession();

bool   ConfirmMarketStructure(string direction);
bool   ConfirmOrderFlow(string direction);
bool   ConfirmVolume();
bool   ConfirmSessionBias(string direction);
bool   ValidateTradeSetup(string direction);

bool   IsRegimeSuitable();
bool   IsOptimalTiming();
bool   IsRegimeFavorable(string direction);
bool   IsWithinTradeHours();
bool   CanAddGridTrade(string direction, double minDistancePips);
bool   IsTrendLockActive(string currentTrend);

void   ResetDailyRiskIfNeeded();
void   UpdatePositionManagement();
void   UpdateEnhancedExits();
void   UpdateTrailingSL();
void   UpdateBreakEven();
void   UpdateSmartClose();
void   CloseAllPositions();

void   UpdateRiskMetrics();
void   AddTradeResult(double profitLoss);
double CalculateEnhancedLotSize();

double CalculateVolatilityMultiplier();
double CalculateConfidenceMultiplier();
double CalculateDrawdownProtection();
double CalculatePerformanceMultiplier();

MTFSignal          AnalyzeTimeframe(ENUM_TIMEFRAMES tf, int emaFastHandle, int emaSlowHandle, int rsiHandle, int macdHandle, int atrHandle);

ConfluenceAnalysis CalculateConfluenceScore(MTFSignal &signals[]);

bool GenerateEnhancedBuySignal (double emaFast, double emaSlow, double rsi, double macdMain, double macdSignal, double atr, double vwap);
bool GenerateEnhancedSellSignal(double emaFast, double emaSlow, double rsi, double macdMain, double macdSignal, double atr, double vwap);

void   OptimizeAIParameters();
double CalculateRecentAIPerformance();
// TO THESE:

void   ExtractMarketFeatures(double &features[]);
double NormalizeIndicator(double value, double min, double max);
AIDecision AnalyzeEnhancedPatterns(double &currentFeatures[]);
double CalculateTimeWeight(datetime patternTime);
double CalculatePatternSimilarity(double &features1[], double &features2[]);
double CalculateDecisionQuality(AIDecision &decision, double &features[]);

void   UpdateAILearning();
void   LearnFromCompletedTrades();
void   StoreLearningPattern(double profitLoss, datetime tradeTime);
void   RemoveLeastImportantPattern();
double CalculatePatternImportance(AIPattern &pattern);
double CalculatePatternConfidence(AIPattern &pattern);

bool   GenerateAIEnhancedBuySignal (double emaFast, double emaSlow, double rsi, double macdMain, double macdSignal, double atr, double vwap, AIDecision &aiDecision);
bool   GenerateAIEnhancedSellSignal(double emaFast, double emaSlow, double rsi, double macdMain, double macdSignal, double atr, double vwap, AIDecision &aiDecision);
bool   ValidateAITradeSetup(string direction, AIDecision &aiDecision);
void   ExecuteAIEnhancedTrade(string type, AIDecision &aiDecision);

// ========================== INIT =================================
int OnInit()
{
  // License check (skip in tester)
  if(!MQLInfoInteger(MQL_TESTER)) {
    if(AccountInfoInteger(ACCOUNT_LOGIN) != ZONEX_LICENSED_ACCOUNT) {
      Print("❌ Unauthorized account: ", AccountInfoInteger(ACCOUNT_LOGIN), " | Expected: ", ZONEX_LICENSED_ACCOUNT);
      ExpertRemove(); return INIT_FAILED;
    }
    datetime expiry = StringToTime(ZONEX_LICENSE_EXPIRY + " 23:59");
    if(TimeCurrent() > expiry) {
      Print("❌ License expired on ", ZONEX_LICENSE_EXPIRY);
      ExpertRemove(); return INIT_FAILED;
    }
  }

  string sym = (TradeSymbol == "") ? _Symbol : TradeSymbol;
  ENUM_TIMEFRAMES tf = PERIOD_M15;

  handleEMA_Fast = iMA(sym, tf, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
  handleEMA_Slow = iMA(sym, tf, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
  handleRSI      = iRSI(sym, tf, RSI_Period, PRICE_CLOSE);
  handleMACD     = iMACD(sym, tf, MACD_Fast, MACD_Slow, MACD_Signal, PRICE_CLOSE);
  handleATR      = iATR(sym, tf, ATR_Period);

  handleVWAP     = iCustom(sym, tf, "VWAP");
  if(handleVWAP == INVALID_HANDLE) { vwapAvailable=false; Print("⚠️ VWAP not available — disabling VWAP filter."); }

  if(handleEMA_Fast==INVALID_HANDLE || handleEMA_Slow==INVALID_HANDLE ||
     handleRSI==INVALID_HANDLE || handleMACD==INVALID_HANDLE || handleATR==INVALID_HANDLE) {
    Print("❌ Critical indicator handles invalid!"); return INIT_FAILED;
  }

  if(!InitializeMTFIndicators()) { Print("❌ MTF initialization failed!"); return INIT_FAILED; }

  if(UseAI_Level1 || UseAI_Level2) {
    if(!InitializeAISystem()) { Print("❌ AI System initialization failed!"); return INIT_FAILED; }
    Print("🤖 AI System initialized. L1:", UseAI_Level1, " L2:", UseAI_Level2, " Adaptive:", AI_AdaptiveParameters, " Safe:", AI_SafeMode);
  }

  ArrayInitialize(recentTrades, 0.0); recentTradeIndex=0; totalRecentTrades=0;
  InitializeMetrics();
  lastDayReset = 0; dailyRiskUsed = 0.0;

  g_zonexMagic  = MagicNumber;
  g_dashSymbol  = (TradeSymbol == "") ? _Symbol : TradeSymbol;
  trade.SetExpertMagicNumber(MagicNumber);

  if(ShowDashboard)
    {
     DashInitTracking();
     CreateDashboard();
     g_dashHistoryTick = DashboardUpdateTicks;
     UpdateDashboard();
    }

  EventSetTimer(3600); // hourly
  Print("✅ ZoneX Bot initialized | Symbol:", sym, " TF:M15");
  return INIT_SUCCEEDED;
}

bool InitializeMTFIndicators()
{
  string sym = (TradeSymbol == "") ? _Symbol : TradeSymbol;

  handleEMA_Fast_H1 = iMA(sym, PERIOD_H1, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
  handleEMA_Slow_H1 = iMA(sym, PERIOD_H1, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
  handleRSI_H1      = iRSI(sym, PERIOD_H1, RSI_Period, PRICE_CLOSE);
  handleMACD_H1     = iMACD(sym, PERIOD_H1, MACD_Fast, MACD_Slow, MACD_Signal, PRICE_CLOSE);
  handleATR_H1      = iATR(sym, PERIOD_H1, ATR_Period);

  handleEMA_Fast_H4 = iMA(sym, PERIOD_H4, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
  handleEMA_Slow_H4 = iMA(sym, PERIOD_H4, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
  handleRSI_H4      = iRSI(sym, PERIOD_H4, RSI_Period, PRICE_CLOSE);
  handleMACD_H4     = iMACD(sym, PERIOD_H4, MACD_Fast, MACD_Slow, MACD_Signal, PRICE_CLOSE);
  handleATR_H4      = iATR(sym, PERIOD_H4, ATR_Period);

  bool ok = (handleEMA_Fast_H1!=INVALID_HANDLE && handleEMA_Slow_H1!=INVALID_HANDLE &&
             handleRSI_H1!=INVALID_HANDLE && handleMACD_H1!=INVALID_HANDLE && handleATR_H1!=INVALID_HANDLE &&
             handleEMA_Fast_H4!=INVALID_HANDLE && handleEMA_Slow_H4!=INVALID_HANDLE &&
             handleRSI_H4!=INVALID_HANDLE && handleMACD_H4!=INVALID_HANDLE && handleATR_H4!=INVALID_HANDLE);

  if(ok) Print("✅ MTF indicators initialized successfully");
  else   Print("❌ MTF indicator handle invalid");
  return ok;
}

bool InitializeAISystem()
{
  if(AI_SafeMode) {
    adaptiveParams.currentConfidenceThreshold = MathMax(0.70, AI_ConfidenceThreshold);
    adaptiveParams.currentLearningRate        = MathMin(0.02,  AI_LearningRate);
    adaptiveParams.currentMemorySize          = MathMin(500,   AI_MaxMemorySize);
    Print("🛡️ AI Safe Mode → Conf:", DoubleToString(adaptiveParams.currentConfidenceThreshold,2),
          " Learn:", DoubleToString(adaptiveParams.currentLearningRate,3),
          " Memory:", adaptiveParams.currentMemorySize);
  } else {
    adaptiveParams.currentConfidenceThreshold = AI_ConfidenceThreshold;
    adaptiveParams.currentLearningRate        = AI_LearningRate;
    adaptiveParams.currentMemorySize          = AI_MaxMemorySize;
  }
  adaptiveParams.currentLearningPeriod = AI_LearningPeriod;

  ArrayResize(aiPatterns, adaptiveParams.currentMemorySize);
  ArrayResize(aiLearningHistory, adaptiveParams.currentLearningPeriod*2);
  ArrayInitialize(aiLearningHistory, 0.0);

  neuralNetwork = NeuralWeights();
  aiInitialized = true; lastAIOptimization = TimeCurrent();

  Print("🧠 AI neural network initialized (weights randomized).");
  return true;
}

void InitializeMetrics()
{
  metrics.winRate=0.0; metrics.avgWin=0.0; metrics.avgLoss=0.0; metrics.profitFactor=0.0;
  metrics.totalTrades=0; metrics.maxDD=0.0; metrics.consistency=0.0;
}

// ============================ TICK ================================
void OnTick()
{
  UpdateDashboard();

  string sym = (TradeSymbol == "") ? _Symbol : TradeSymbol;
  if(!IsNewCandle(sym)) return;

  UpdateMarketState();

  if(UseAI_Level1 || UseAI_Level2) {
    UpdateAILearning();
    if(AI_AdaptiveParameters) OptimizeAIParameters();
  }

  ResetDailyRiskIfNeeded();

  if(PositionsTotal() >= MaxTotalOrders) return;

  if(!UseFixedLot) DisplayLot = CalculateEnhancedLotSize();

  if(!IsWithinTradeHours()) return;
  if(UseRegimeFilter && OnlyTradeStrongRegimes && !IsRegimeSuitable()) return;
  if(UseOptimalTiming && !IsOptimalTiming()) return;
  if(AvoidNewsImpact && marketState.newsImpact) return;

  // Indicators (M15)
  double emaFast = GetValue(handleEMA_Fast);
  double emaSlow = GetValue(handleEMA_Slow);
  double rsi     = GetValue(handleRSI);
  double atr     = GetValue(handleATR);
  double vwap    = (UseVWAPFilter && vwapAvailable) ? GetValue(handleVWAP) : 0.0;

  if(emaFast==0.0 || emaSlow==0.0 || rsi==0.0 || atr==0.0) return;

  double macdMain, macdSignal;
  if(!GetMACD(handleMACD, macdMain, macdSignal)) return;

  // AI decision (pre-computed)
  AIDecision aiDecision;
  if(UseAI_Level1 && aiInitialized) {
    aiDecision = GetAIDecisionData();
    lastAIDecision = aiDecision;
    if(aiDecision.confidence >= adaptiveParams.currentConfidenceThreshold) {
      Print("🤖 AI Decision: ", aiDecision.action,
            " | Conf:", DoubleToString(aiDecision.confidence,2),
            " | Exp:",  DoubleToString(aiDecision.expectedReturn,2),
            " | Q:",    DoubleToString(aiDecision.qualityScore,2));
    }
  }

  bool wantBuy  = GenerateAIEnhancedBuySignal (emaFast, emaSlow, rsi, macdMain, macdSignal, atr, vwap, aiDecision);
  bool wantSell = GenerateAIEnhancedSellSignal(emaFast, emaSlow, rsi, macdMain, macdSignal, atr, vwap, aiDecision);

  if(wantBuy  && ValidateAITradeSetup("BUY",  aiDecision)) ExecuteAIEnhancedTrade("BUY",  aiDecision);
  if(wantSell && ValidateAITradeSetup("SELL", aiDecision)) ExecuteAIEnhancedTrade("SELL", aiDecision);

  UpdatePositionManagement();
}

// ====================== MARKET / VALIDATION =======================
double GetValue(int handle)
{
  if(handle==INVALID_HANDLE) return 0.0;
  double buf[1];
  if(CopyBuffer(handle, 0, 0, 1, buf) > 0) return buf[0];
  return 0.0;
}

bool GetMACD(int handle, double &main, double &signal)
{
  double b0[1], b1[1];
  if(CopyBuffer(handle,0,0,1,b0)>0 && CopyBuffer(handle,1,0,1,b1)>0) {
    main = b0[0]; signal = b1[0]; return true;
  }
  return false;
}

bool IsNewCandle(string symbol)
{
  long lastbar=0;
  if(!SeriesInfoInteger(symbol, PERIOD_M15, SERIES_LASTBAR_DATE, lastbar)) return false;
  static datetime last=0;
  datetime now = (datetime)lastbar;
  if(now!=last) { last=now; return true; }
  return false;
}

void UpdateMarketState()
{
  static datetime lastUpdate=0;
  static int      updateCounter=0;
  updateCounter++;
  if(updateCounter<5 && TimeCurrent()-lastUpdate<300) return;
  updateCounter=0; lastUpdate=TimeCurrent();

  double emaFast = GetValue(handleEMA_Fast);
  double emaSlow = GetValue(handleEMA_Slow);
  double atr     = GetValue(handleATR);

  if(emaFast > emaSlow*1.001) { marketState.regime="UPTREND"; marketState.bias="BULLISH"; }
  else if(emaFast < emaSlow*0.999) { marketState.regime="DOWNTREND"; marketState.bias="BEARISH"; }
  else { marketState.regime="RANGE"; marketState.bias="NEUTRAL"; }

  double spread = (emaSlow!=0.0) ? MathAbs(emaFast-emaSlow)/emaSlow : 0.0;
  marketState.strength = MathMin(1.0, spread*100.0);

  double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
  marketState.volatility = (price>0.0) ? (atr/price) : 0.0;

  static double lastATR=0.0;
  marketState.newsImpact = (lastATR>0.0 && atr>lastATR*1.5);
  lastATR=atr;

  marketState.session = GetCurrentSession();
}

string GetCurrentSession()
{
  MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
  int h=dt.hour;
  if(h>=8 && h<16)  return "LONDON";
  if(h>=13 && h<22) return "NEW_YORK";
  if(h>=22 || h<8)  return "ASIAN";
  return "OVERLAP";
}

bool ConfirmMarketStructure(string direction)
{
  if(!UseMarketStructureFilter) return true;

  double highs[], lows[];
  int lookback = MathMax(3, MathMin(StructureLookback, 50));

  if(CopyHigh(_Symbol, PERIOD_M15, 1, lookback, highs)<=0) return true;
  if(CopyLow (_Symbol, PERIOD_M15, 1, lookback, lows )<=0) return true;

  ArraySetAsSeries(highs,true); ArraySetAsSeries(lows,true);

  if(direction=="BUY") {
    int higherLows=0;
    for(int i=1;i<lookback-1;i++) if(lows[i]>lows[i+1]) higherLows++;
    return (higherLows > lookback*0.4);
  } else {
    int lowerHighs=0;
    for(int i=1;i<lookback-1;i++) if(highs[i]<highs[i+1]) lowerHighs++;
    return (lowerHighs > lookback*0.4);
  }
}

bool ConfirmOrderFlow(string direction)
{
  if(!UseOrderFlowFilter) return true;

  double closes[], opens[];
  int period = MathMax(3, MathMin(OrderFlowPeriod, 20));

  if(CopyClose(_Symbol, PERIOD_M15, 1, period, closes)<=0) return true;
  if(CopyOpen (_Symbol, PERIOD_M15, 1, period, opens )<=0) return true;

  ArraySetAsSeries(closes,true); ArraySetAsSeries(opens,true);

  int bullishBars=0;
  for(int i=0;i<period;i++) if(closes[i]>opens[i]) bullishBars++;

  double bullishRatio=(double)bullishBars/period;

  if(direction=="BUY")  return (bullishRatio>0.4);
  if(direction=="SELL") return (bullishRatio<0.6);
  return true;
}

bool ConfirmVolume()
{
  if(!UseVolumeConfirmation) return true;
  long volumes[];
  if(CopyTickVolume(_Symbol, PERIOD_M15, 1, 10, volumes)<=0) return true;
  ArraySetAsSeries(volumes,true);
  long currentVol=volumes[0];
  long avgVol=0;
  for(int i=1;i<10;i++) avgVol+=volumes[i];
  avgVol = avgVol/9;
  return (currentVol > (long)(avgVol*(VolumeMultiplier*0.8)));
}

bool ConfirmSessionBias(string direction)
{
  if(!UseSessionBias) return true;
  string s=marketState.session;
  if(s=="LONDON")   return true;
  if(s=="NEW_YORK") return (marketState.strength>0.3);
  if(s=="ASIAN")    return true;
  return true;
}

bool ValidateTradeSetup(string direction)
{
  if(TimeCurrent() - lastEntryTime < EntryCooldownMinutes*60) return false;

  if(UseTrendMemory && !IsTrendLockActive(direction)) return false;

  if(EnableGridTrading) {
    if(!CanAddGridTrade(direction, GridStepPips)) return false;
    if(UseRegimeFilter && !IsRegimeFavorable(direction)) return false;
  }

  if(UseCorrelationFilter) {
    int sameDir=0;
    int total = PositionsTotal();
    for(int i=0;i<total;i++){
      if(!PositionGetTicket(i)) continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
      long type = PositionGetInteger(POSITION_TYPE);
      string posDir = (type==POSITION_TYPE_BUY)?"BUY":"SELL";
      if(posDir==direction) sameDir++;
    }
    if(sameDir>=3) return false;
  }
  return true;
}

bool IsRegimeSuitable()
{
  return (marketState.strength>0.6 && (marketState.regime=="UPTREND" || marketState.regime=="DOWNTREND"));
}

bool IsOptimalTiming()
{
  MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
  if(dt.hour>=12 && dt.hour<=14) return false;
  if(dt.hour>=17 && dt.hour<=19) return false;
  return true;
}

bool IsRegimeFavorable(string direction)
{
  if(direction=="BUY")
    return (marketState.regime=="UPTREND" || (marketState.regime=="RANGE" && marketState.bias=="BULLISH"));
  return (marketState.regime=="DOWNTREND" || (marketState.regime=="RANGE" && marketState.bias=="BEARISH"));
}

bool IsWithinTradeHours()
{
  if(!UseTradeHourFilter) return true;
  MqlDateTime t; TimeToStruct(TimeCurrent(), t);
  return (t.hour>=TradeHourStart && t.hour<TradeHourEnd);
}

bool CanAddGridTrade(string direction, double minDistancePips)
{
  int count=0;
  double lastPrice=-1.0;

  int total=PositionsTotal();
  for(int i=total-1;i>=0;i--){
    if(!PositionGetTicket(i)) continue;
    if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
    long type = PositionGetInteger(POSITION_TYPE);
    if((direction=="BUY" && type!=POSITION_TYPE_BUY) || (direction=="SELL" && type!=POSITION_TYPE_SELL)) continue;

    double entry=PositionGetDouble(POSITION_PRICE_OPEN);
    count++;
    if(lastPrice<0.0 || (direction=="BUY" && entry>lastPrice) || (direction=="SELL" && entry<lastPrice))
      lastPrice=entry;
  }

  if(count>=MaxClusterPositions) return false;

  double currentPrice = (direction=="BUY")? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                                          : SymbolInfoDouble(_Symbol, SYMBOL_BID);

  if(lastPrice<0.0) return true;

  double distancePips = MathAbs(currentPrice - lastPrice)/Pip();
  return (distancePips >= minDistancePips);
}

bool IsTrendLockActive(string currentTrend)
{
  if(!UseTrendMemory || trendLockedDirection=="") return true;
  if(currentTrend==trendLockedDirection) return true;

  if(TimeCurrent() - trendLockStartTime > TrendMemoryBars * 60 * 15) {
    trendLockedDirection=""; return true;
  }
  return false;
}

void ResetDailyRiskIfNeeded()
{
  MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
  datetime currentDay = StringToTime(StringFormat("%04d.%02d.%02d", dt.year, dt.mon, dt.day));
  if(currentDay != lastDayReset) {
    dailyRiskUsed=0.0; lastDayReset=currentDay;
  }
}

// =================== POSITION MANAGEMENT ==========================
void UpdatePositionManagement()
{
  if(UseSmartClose) UpdateSmartClose();
  if(UseTrailingSL) UpdateTrailingSL();
  if(UseBreakEven)  UpdateBreakEven();
  UpdateEnhancedExits();
}

void UpdateEnhancedExits()
{
  for(int i=PositionsTotal()-1;i>=0;i--){
    if(!PositionGetTicket(i)) continue;
    if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
    ulong ticket = (ulong)PositionGetInteger(POSITION_TICKET);
    long  type   = PositionGetInteger(POSITION_TYPE);
    string dir   = (type==POSITION_TYPE_BUY)?"BUY":"SELL";

    if(!IsRegimeFavorable(dir)) { trade.PositionClose(ticket); continue; }
    if(!ConfirmMarketStructure(dir)) { trade.PositionClose(ticket); continue; }
  }
}

void UpdateTrailingSL()
{
  for(int i=PositionsTotal()-1;i>=0;i--){
    if(!PositionGetTicket(i)) continue;
    if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;

    ulong ticket = (ulong)PositionGetInteger(POSITION_TICKET);
    double open  = PositionGetDouble(POSITION_PRICE_OPEN);
    double tp    = PositionGetDouble(POSITION_TP);
    long   type  = PositionGetInteger(POSITION_TYPE);
    double price = (type==POSITION_TYPE_BUY)? SymbolInfoDouble(_Symbol, SYMBOL_BID)
                                            : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    double distance   = (type==POSITION_TYPE_BUY)? (price-open) : (open-price);
    double trailStart = TrailStart * Pip();
    double trailStep  = TrailStep  * Pip();

    if(distance > trailStart) {
      double newSL = (type==POSITION_TYPE_BUY) ? (price - trailStep) : (price + trailStep);
      trade.PositionModify(ticket, newSL, tp);
    }
  }
}

void UpdateBreakEven()
{
  for(int i=PositionsTotal()-1;i>=0;i--){
    if(!PositionGetTicket(i)) continue;
    if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;

    ulong ticket = (ulong)PositionGetInteger(POSITION_TICKET);
    double entry = PositionGetDouble(POSITION_PRICE_OPEN);
    double sl    = PositionGetDouble(POSITION_SL);
    double tp    = PositionGetDouble(POSITION_TP);
    long   type  = PositionGetInteger(POSITION_TYPE);
    double price = (type==POSITION_TYPE_BUY)? SymbolInfoDouble(_Symbol, SYMBOL_BID)
                                            : SymbolInfoDouble(_Symbol, SYMBOL_ASK);

    double profitPips = (type==POSITION_TYPE_BUY)? (price-entry)/Pip() : (entry-price)/Pip();
    if(profitPips >= BreakEvenStartPips) {
      double newSL = (type==POSITION_TYPE_BUY)
        ? (entry + BreakEvenOffsetPips*Pip())
        : (entry - BreakEvenOffsetPips*Pip());
      if((type==POSITION_TYPE_BUY && sl<newSL) || (type==POSITION_TYPE_SELL && sl>newSL))
        trade.PositionModify(ticket, newSL, tp);
    }
  }
}

void UpdateSmartClose()
{
  double balance = AccountInfoDouble(ACCOUNT_BALANCE);
  double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
  if(balance<=0.0) return;

  double profitPercent = (equity - balance)/balance * 100.0;

  if(PositionsTotal()==0) { maxEquityInCycle=0.0; return; }
  if(profitPercent>maxEquityInCycle) maxEquityInCycle=profitPercent;

  double lockDistance = SmartCloseStartPercent - SmartCloseLockPercent;

  if(profitPercent >= SmartCloseStartPercent) {
    double lockLevel = maxEquityInCycle - lockDistance;
    if(profitPercent <= lockLevel) {
      CloseAllPositions();
      maxEquityInCycle=0.0; trendLockedDirection="";
    }
  }
}

void CloseAllPositions()
{
  for(int i=PositionsTotal()-1;i>=0;i--){
    if(!PositionGetTicket(i)) continue;
    ulong ticket = (ulong)PositionGetInteger(POSITION_TICKET);
    trade.PositionClose(ticket);
  }
}

// ===================== RISK & LOT SIZING ==========================
void UpdateRiskMetrics()
{
  if(totalRecentTrades<3) {
    riskMetrics.recentWinRate=50.0;
    riskMetrics.avgProfit=0.0; riskMetrics.avgLoss=0.0;
    riskMetrics.consecutiveLosses=0.0; riskMetrics.maxDrawdown=0.0;
  } else {
    int wins=0, losses=0, currentLossStreak=0;
    double totalWins=0.0, totalLosses=0.0;

    int lookback = MathMin(PerformanceLookback, totalRecentTrades);
    for(int i=0;i<lookback;i++){
      int index = (recentTradeIndex-1-i+100)%100;
      double result = recentTrades[index];
      if(result>0){ wins++; totalWins+=result; currentLossStreak=0; }
      else        { losses++; totalLosses+=MathAbs(result); if(i<10) currentLossStreak++; }
    }
    riskMetrics.recentWinRate = (double)wins / (double)lookback * 100.0;
    riskMetrics.avgProfit = (wins>0)? totalWins/wins : 0.0;
    riskMetrics.avgLoss   = (losses>0)? totalLosses/losses : 0.0;
    riskMetrics.consecutiveLosses = currentLossStreak;

    double balance = AccountInfoDouble(ACCOUNT_BALANCE);
    double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
    riskMetrics.maxDrawdown = (balance>0.0)? (balance-equity)/balance*100.0 : 0.0;

    double atr = GetValue(handleATR);
    double price = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    riskMetrics.volatilityFactor = (price>0.0)? atr/price*100.0 : 1.0;
  }

  riskMetrics.confidenceFactor = (UseMTFConfluence)? currentConfluence.overallScore : 1.0;
}

void AddTradeResult(double profitLoss)
{
  recentTrades[recentTradeIndex] = profitLoss;
  recentTradeIndex = (recentTradeIndex+1)%100;
  if(totalRecentTrades<100) totalRecentTrades++;
}

double CalculateVolatilityMultiplier()
{
  double currentATR = GetValue(handleATR);
  if(currentATR<=0.0) return 1.0;

  double atrValues[50];
  if(CopyBuffer(handleATR,0,1,50,atrValues)<=0) return 1.0;
  double avgATR=0.0;
  for(int i=0;i<50;i++) avgATR+=atrValues[i];
  avgATR/=50.0; if(avgATR<=0.0) return 1.0;

  double ratio=currentATR/avgATR;
  double m=1.0;
  if(ratio<0.8) m = 1.0 + (0.8-ratio)*0.5;
  else if(ratio>1.5) m = 1.0 - (ratio-1.5)*0.3;

  return MathMax(0.4, MathMin(1.4, m));
}

double CalculateConfidenceMultiplier()
{
  if(!UseMTFConfluence) return 1.0;
  double c=currentConfluence.overallScore;
  double s=currentConfluence.trendStrength;
  double m = 0.7 + (c*0.6) + (s*0.4);
  return MathMax(0.5, MathMin(1.5, m));
}

double CalculateDrawdownProtection()
{
  double balance=AccountInfoDouble(ACCOUNT_BALANCE);
  double equity =AccountInfoDouble(ACCOUNT_EQUITY);
  if(balance<=0.0) return 1.0;

  double dd = (balance-equity)/balance*100.0;
  if(dd<=0.0) return 1.0;

  double protection=1.0;
  if(dd>2.0) protection = 1.0 - (dd-2.0)*0.1;
  return MathMax(0.2, protection);
}

double CalculatePerformanceMultiplier()
{
  if(totalRecentTrades<5) return 1.0;

  int wins=0; double totalProfit=0.0;
  int lookback=MathMin(PerformanceLookback, totalRecentTrades);
  for(int i=0;i<lookback;i++){
    int index=(recentTradeIndex-1-i+100)%100;
    if(recentTrades[index]>0.0) wins++;
    totalProfit += recentTrades[index];
  }
  double winRate = (double)wins/(double)lookback;
  double avgResult = totalProfit/(double)lookback;

  double m=1.0;
  if(winRate>0.6) m*=1.3;
  else if(winRate<0.4) m*=0.7;

  if(avgResult>0.0)  m *= (1.0 + MathMin(0.5, avgResult/100.0));
  else               m *= (1.0 + MathMax(-0.5, avgResult/100.0));

  return MathMax(0.3, MathMin(2.0, m));
}

DynamicRiskCalculation CalculateDynamicRiskCalculation()
{
  DynamicRiskCalculation risk;
  risk.baseRisk  = BaseRiskPercent;
  risk.finalRisk = BaseRiskPercent;
  risk.performanceMultiplier=1.0;
  risk.volatilityMultiplier =1.0;
  risk.confidenceMultiplier =1.0;
  risk.drawdownReduction    =1.0;

  if(!UseDynamicRisk) { lastRiskCalc=risk; return risk; }

  UpdateRiskMetrics();
  if(UseConfidenceScaling)  risk.performanceMultiplier = CalculatePerformanceMultiplier();
  if(UseVolatilityScaling)  risk.volatilityMultiplier  = CalculateVolatilityMultiplier();
  if(UseConfidenceScaling && UseMTFConfluence) risk.confidenceMultiplier = CalculateConfidenceMultiplier();
  if(UseDrawdownProtection_New) risk.drawdownReduction = CalculateDrawdownProtection();

  risk.finalRisk = risk.baseRisk * risk.performanceMultiplier * risk.volatilityMultiplier
                 * risk.confidenceMultiplier * risk.drawdownReduction;

  risk.finalRisk = MathMax(MinRiskPercent, MathMin(MaxRiskPercent, risk.finalRisk));
  risk.reasoning = StringFormat("Perf:%.2f Vol:%.2f Conf:%.2f DD:%.2f",
                                risk.performanceMultiplier, risk.volatilityMultiplier,
                                risk.confidenceMultiplier, risk.drawdownReduction);
  lastRiskCalc=risk; return risk;
}

double CalculateEnhancedLotSize()
{
  if(UseFixedLot) return FixedLot;

  DynamicRiskCalculation rc = CalculateDynamicRiskCalculation();

  double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
  double riskAmt  = balance * (rc.finalRisk/100.0);
  double tickValue= SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
  double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
  double slDist   = SL_Pips * Pip();

  double valuePerLot = (tickSize>0.0) ? (tickValue/tickSize)*slDist : 0.0;
  if(valuePerLot<=0.0) return 0.0;

  double lot = riskAmt/valuePerLot;

  double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
  double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
  double step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

  if(step<=0.0) step=0.01;
  lot = MathFloor(lot/step)*step;
  lot = MathMax(minLot, MathMin(maxLot, lot));
  lot = NormalizeDouble(lot, 2);
  return lot;
}

// =================== MTF CONFLUENCE ===============================
MTFSignal AnalyzeTimeframe(ENUM_TIMEFRAMES tf, int emaFastHandle, int emaSlowHandle, int rsiHandle, int macdHandle, int atrHandle)
{
  MTFSignal s; s.timeframe=tf; s.isValid=false;

  double emaF=GetValue(emaFastHandle);
  double emaS=GetValue(emaSlowHandle);
  double rsi =GetValue(rsiHandle);
  double atr =GetValue(atrHandle);

  double macdM, macdS;
  if(!GetMACD(macdHandle, macdM, macdS)) return s;

  if(emaF==0.0 || emaS==0.0 || rsi==0.0 || atr==0.0) return s;

  double emaDiff = (emaS!=0.0)? (emaF-emaS)/emaS : 0.0;
  s.trendStrength = MathMax(-1.0, MathMin(1.0, emaDiff*100.0));
  s.momentum = macdM - macdS;

  double mid = (SymbolInfoDouble(_Symbol, SYMBOL_ASK)+SymbolInfoDouble(_Symbol, SYMBOL_BID))/2.0;
  s.volatility = (mid>0.0)? (atr/mid) : 0.0;
  s.support_resistance = 0.5;
  s.isValid=true;
  return s;
}

ConfluenceAnalysis CalculateConfluenceScore(MTFSignal &signals[])
{
  ConfluenceAnalysis r;
  double weights[3]={0.3,0.4,0.3};
  double total=0.0, wsum=0.0; int valid=0;

  for(int i=0;i<3;i++){
    if(signals[i].isValid){ total += signals[i].trendStrength * weights[i]; wsum+=weights[i]; valid++; }
  }
  if(valid==0) return r;
  double avg = (wsum>0.0)? total/wsum : 0.0;

  if(avg>0.2) r.trendDirection="BULLISH";
  else if(avg<-0.2) r.trendDirection="BEARISH";
  else r.trendDirection="NEUTRAL";

  r.trendStrength = MathAbs(avg);

  double agreement=0.0; int pairs=0;
  for(int i=0;i<3;i++){
    for(int j=i+1;j<3;j++){
      if(signals[i].isValid && signals[j].isValid){
        bool same = (signals[i].trendStrength*signals[j].trendStrength)>0.0;
        if(same){
          double sim = 1.0 - MathAbs(signals[i].trendStrength - signals[j].trendStrength);
          agreement += sim;
        }
        pairs++;
      }
    }
  }
  if(pairs>0) r.overallScore = agreement/pairs;

  if(r.trendStrength>0.5 && valid==3) r.overallScore *= 1.2;
  r.overallScore = MathMin(1.0, r.overallScore);
  r.highConfidence = (r.overallScore>=MTF_MinConfluence && r.trendStrength>0.4);

  for(int i=0;i<3;i++) r.timeframes[i]=signals[i];
  return r;
}

ConfluenceAnalysis AnalyzeMTFConfluence()
{
  ConfluenceAnalysis c;
  if(!UseMTFConfluence) { c.overallScore=1.0; c.trendDirection="NEUTRAL"; c.trendStrength=0.0; c.highConfidence=true; return c; }

  mtfSignals[0] = AnalyzeTimeframe(PERIOD_M15, handleEMA_Fast, handleEMA_Slow, handleRSI, handleMACD, handleATR);
  mtfSignals[1] = AnalyzeTimeframe(PERIOD_H1,  handleEMA_Fast_H1, handleEMA_Slow_H1, handleRSI_H1, handleMACD_H1, handleATR_H1);
  mtfSignals[2] = AnalyzeTimeframe(PERIOD_H4,  handleEMA_Fast_H4, handleEMA_Slow_H4, handleRSI_H4, handleMACD_H4, handleATR_H4);

  c = CalculateConfluenceScore(mtfSignals);
  currentConfluence=c;
  return c;
}

// ===================== SIGNAL GENERATION ==========================
bool GenerateEnhancedBuySignal(double emaFast, double emaSlow, double rsi, double macdMain, double macdSignal, double atr, double vwap)
{
  bool core = (emaFast>emaSlow && rsi<55 && macdMain>macdSignal && atr>Min_ATR);
  if(!core) return false;

  if(UseMTFConfluence) {
    ConfluenceAnalysis conf = AnalyzeMTFConfluence();
    if(conf.overallScore < MTF_MinConfluence) return false;
    if(RequireHTFTrend && conf.trendDirection!="BULLISH") return false;
  }

  int filterScore=0, totalFilters=0;

  if(UseMarketStructureFilter){ totalFilters++; if(ConfirmMarketStructure("BUY"))  filterScore++; }
  if(UseOrderFlowFilter)      { totalFilters++; if(ConfirmOrderFlow("BUY"))       filterScore++; }
  if(UseVolumeConfirmation)   { totalFilters++; if(ConfirmVolume())               filterScore++; }

  if(UseVWAPFilter && vwapAvailable){
    double bid=SymbolInfoDouble(_Symbol, SYMBOL_BID);
    if(bid < vwap - (20*Pip())) return false;
  }

  if(UseSessionBias){ totalFilters++; if(ConfirmSessionBias("BUY")) filterScore++; }

  if(totalFilters>0){
    double agree=(double)filterScore/(double)totalFilters;
    return (agree>=0.6);
  }
  return true;
}

bool GenerateEnhancedSellSignal(double emaFast, double emaSlow, double rsi, double macdMain, double macdSignal, double atr, double vwap)
{
  bool core = (emaFast<emaSlow && rsi>45 && macdMain<macdSignal && atr>Min_ATR);
  if(!core) return false;

  if(UseMTFConfluence) {
    ConfluenceAnalysis conf = AnalyzeMTFConfluence();
    if(conf.overallScore < MTF_MinConfluence) return false;
    if(RequireHTFTrend && conf.trendDirection!="BEARISH") return false;
  }

  int filterScore=0, totalFilters=0;

  if(UseMarketStructureFilter){ totalFilters++; if(ConfirmMarketStructure("SELL")) filterScore++; }
  if(UseOrderFlowFilter)      { totalFilters++; if(ConfirmOrderFlow("SELL"))      filterScore++; }
  if(UseVolumeConfirmation)   { totalFilters++; if(ConfirmVolume())               filterScore++; }

  if(UseVWAPFilter && vwapAvailable){
    double ask=SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    if(ask > vwap + (20*Pip())) return false;
  }

  if(UseSessionBias){ totalFilters++; if(ConfirmSessionBias("SELL")) filterScore++; }

  if(totalFilters>0){
    double agree=(double)filterScore/(double)totalFilters;
    return (agree>=0.6);
  }
  return true;
}

// ====================== AI SYSTEM (L1) ============================
void OptimizeAIParameters()
{
  if(TimeCurrent()-lastAIOptimization<3600 || aiTradeCount<10) return;
  lastAIOptimization=TimeCurrent();

  double perf=CalculateRecentAIPerformance();
  adaptiveParams.performanceScore=perf;
  Print("🎯 AI Optimization: performance=", DoubleToString(perf,2));

  double oldConf=adaptiveParams.currentConfidenceThreshold;
  if(perf>0.7)      adaptiveParams.currentConfidenceThreshold = MathMax(0.6, adaptiveParams.currentConfidenceThreshold-0.05);
  else if(perf<0.4) adaptiveParams.currentConfidenceThreshold = MathMin(0.9, adaptiveParams.currentConfidenceThreshold+0.05);

  if(aiTradeCount>100) {
    if(perf>0.6) adaptiveParams.currentLearningRate = MathMax(0.005, adaptiveParams.currentLearningRate*0.95);
    else         adaptiveParams.currentLearningRate = MathMin(0.05,  adaptiveParams.currentLearningRate*1.10);
  }

  if(aiPatternCount > (int)(adaptiveParams.currentMemorySize*0.8)) {
    adaptiveParams.currentMemorySize = MathMin(2000, (int)(adaptiveParams.currentMemorySize*1.2));
    ArrayResize(aiPatterns, adaptiveParams.currentMemorySize);
  }

  if(MathAbs(oldConf-adaptiveParams.currentConfidenceThreshold)>0.01) {
    Print("🔧 AI Confidence adjusted: ", DoubleToString(oldConf,2),
          " → ", DoubleToString(adaptiveParams.currentConfidenceThreshold,2));
  }
}

double CalculateRecentAIPerformance()
{
  if(aiTradeCount<5) return 0.5;

  int recent = MathMin(20, aiTradeCount);
  double tot=0.0; int wins=0;

  int len = adaptiveParams.currentLearningPeriod*2;
  if(len<=0) len=100;

  for(int i=0;i<recent;i++){
    int idx = (learningIndex-1-i+len)%len;
    double v = aiLearningHistory[idx];
    if(v!=0.0) { tot+=v; if(v>0.0) wins++; }
  }

  double wr = (double)wins/(double)recent;
  double avg= tot/(double)recent;
  double perf = (wr*0.6) + ((avg>0.0?1.0:0.0)*0.4);
  return MathMax(0.0, MathMin(1.0, perf));
}

AIDecision GetAIDecisionData() 
{
  AIDecision d;
  if(!aiInitialized || aiPatternCount<5 || !AI_UsePatternRecognition) {
    d.reasoning="Insufficient learning data";
    return d;
  }

  double f[15]; ExtractMarketFeatures(f);

  if(UseAI_Level1) {
    AIDecision d2 = AnalyzeEnhancedPatterns(f);
    if(d2.confidence > d.confidence) d=d2;
  }

  d.qualityScore = CalculateDecisionQuality(d, f);
  return d;
}

double CalculateDecisionQuality(AIDecision &decision, double &features[])
{
  double q=decision.confidence;
  if(features[13]>0.8) q+=0.1; // MTF conf
  if(features[8] >0.7) q+=0.1; // strong trend
  if(features[11]>0.6) q+=0.1; // good recent win rate
  if(features[12]>0.15) q-=0.2; // high drawdown
  if(marketState.volatility>1.5) q-=0.1;
  return MathMax(0.0, MathMin(1.0, q));
}

void ExtractMarketFeatures(double &features[])
{
  features[0] = NormalizeIndicator(GetValue(handleEMA_Fast), 0, 2);
  features[1] = NormalizeIndicator(GetValue(handleEMA_Slow), 0, 2);
  features[2] = NormalizeIndicator(GetValue(handleRSI), 0, 100);
  features[3] = NormalizeIndicator(GetValue(handleATR), 0, 0.01);

  double m,s; GetMACD(handleMACD, m, s);
  features[4] = NormalizeIndicator(m, -0.01, 0.01);
  features[5] = NormalizeIndicator(s, -0.01, 0.01);

  features[6] = NormalizeIndicator(marketState.volatility, 0, 2);
  features[7] = (marketState.bias=="BULLISH")? 1.0 : (marketState.bias=="BEARISH"? -1.0 : 0.0);
  features[8] = marketState.strength;

  MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
  features[9]  = (double)dt.hour/24.0;
  features[10] = (double)dt.day_of_week/7.0;

  features[11] = NormalizeIndicator(riskMetrics.recentWinRate, 0, 100);
  features[12] = NormalizeIndicator(riskMetrics.maxDrawdown,  0, 20);
  features[13] = NormalizeIndicator(currentConfluence.overallScore, 0, 1);
  features[14] = NormalizeIndicator(dailyRiskUsed, 0, 10);
}

double NormalizeIndicator(double value, double min, double max)
{
  if(max<=min) return 0.5;
  double n=(value-min)/(max-min);
  return MathMax(0.0, MathMin(1.0, n));
}

AIDecision AnalyzeEnhancedPatterns(double &currentFeatures[])
{
  AIDecision d;

  double bestMatch=0.0;
  string bestOutcome="UNKNOWN";
  double wConf=0.0, wRet=0.0, wSum=0.0;
  int matches=0;

  for(int i=0;i<aiPatternCount;i++){
    double sim=CalculatePatternSimilarity(currentFeatures, aiPatterns[i].indicators);
    if(sim>0.65){
      matches++;
      double timeW = CalculateTimeWeight(aiPatterns[i].timestamp);
      double impW  = aiPatterns[i].importance;
      double patW  = sim * timeW * impW * aiPatterns[i].confidence;

      wConf += patW;
      wRet  += aiPatterns[i].profitLoss * patW;
      wSum  += patW;

      if(sim>bestMatch){ bestMatch=sim; bestOutcome=aiPatterns[i].outcome; }
    }
  }

  if(matches>0 && wSum>0.0){
    d.confidence     = wConf/wSum;
    d.expectedReturn = wRet /wSum;

    if(d.expectedReturn >  0.01) d.action="BUY";
    else if(d.expectedReturn < -0.01) d.action="SELL";
    else d.action="HOLD";

    if(matches>5) d.confidence *= 1.1;
    d.confidence = MathMin(1.0, d.confidence);

    d.reasoning = StringFormat("Enhanced pattern: %d matches, best sim=%.2f", matches, bestMatch);
  }
  return d;
}

double CalculateTimeWeight(datetime patternTime)
{
  double hours = (double)(TimeCurrent()-patternTime)/3600.0;
  return MathMax(0.1, 1.0 - (hours/(24.0*30.0))); // ~30 days decay
}

double CalculatePatternSimilarity(double &f1[], double &f2[])
{
  double total=0.0; int valid=0;
  double w[15] = {1.2,1.2,1.5,1.0,1.3,1.3,1.1,1.4,1.4,0.8,0.8,1.2,1.1,1.5,0.9};

  for(int i=0;i<15;i++){
    if(f1[i]!=0.0 || f2[i]!=0.0){
      double diff = MathAbs(f1[i]-f2[i]) * w[i];
      total += diff; valid++;
    }
  }
  if(valid==0) return 0.0;
  double avg = total/valid;
  return MathMax(0.0, 1.0-avg);
}

void UpdateAILearning()
{
  LearnFromCompletedTrades();
}

void LearnFromCompletedTrades()
{
  static datetime lastLearn=0;
  if(TimeCurrent()-lastLearn<300) return;
  lastLearn=TimeCurrent();

  if(!HistorySelect(TimeCurrent()-3600, TimeCurrent())) return;
  int deals = HistoryDealsTotal();
  for(int i=deals-1;i>=0;i--){
    ulong ticket = HistoryDealGetTicket(i);
    if(ticket==0) continue;

    string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
    long   magic  = HistoryDealGetInteger(ticket, DEAL_MAGIC);
    long   entry  = HistoryDealGetInteger(ticket, DEAL_ENTRY);
    if(symbol==_Symbol && magic==MagicNumber && entry==DEAL_ENTRY_OUT){
      double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      datetime closeTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      StoreLearningPattern(profit, closeTime);
      break;
    }
  }
}

void StoreLearningPattern(double profitLoss, datetime tradeTime)
{
  if(!AI_UsePatternRecognition) return;

  if(aiPatternCount >= adaptiveParams.currentMemorySize) RemoveLeastImportantPattern();

  AIPattern p;
  ExtractMarketFeatures(p.indicators);

  p.marketState[0] = marketState.volatility;
  p.marketState[1] = marketState.strength;
  p.marketState[2] = (marketState.bias=="BULLISH")? 1.0 : (marketState.bias=="BEARISH"? -1.0 : 0.0);
  p.marketState[3] = currentConfluence.overallScore;
  p.marketState[4] = riskMetrics.recentWinRate/100.0;

  if(profitLoss>0.01){ p.outcome="WIN";  aiWinningTrades++; aiTotalProfit+=profitLoss; }
  else if(profitLoss<-0.01){ p.outcome="LOSS"; aiLosingTrades++; aiTotalLoss+=MathAbs(profitLoss); }
  else p.outcome="BREAKEVEN";

  p.profitLoss=profitLoss; p.timestamp=tradeTime;
  p.confidence = CalculatePatternConfidence(p);
  p.importance = CalculatePatternImportance(p);

  aiPatterns[aiPatternCount]=p; aiPatternCount++; aiTradeCount++;

  Print("🧠 Learned pattern: ", p.outcome, " | P/L:", DoubleToString(profitLoss,2),
        " | Conf:", DoubleToString(p.confidence,2), " | Total:", aiPatternCount);
}

void RemoveLeastImportantPattern()
{
  if(aiPatternCount==0) return;
  int idx=0; double minW = aiPatterns[0].importance * CalculateTimeWeight(aiPatterns[0].timestamp);
  for(int i=1;i<aiPatternCount;i++){
    double w = aiPatterns[i].importance * CalculateTimeWeight(aiPatterns[i].timestamp);
    if(w<minW){ minW=w; idx=i; }
  }
  for(int i=idx;i<aiPatternCount-1;i++) aiPatterns[i]=aiPatterns[i+1];
  aiPatternCount--;
}

double CalculatePatternImportance(AIPattern &pattern)
{
  double imp=0.5;
  imp += MathMin(0.3, MathAbs(pattern.profitLoss)*5.0);
  if(pattern.marketState[1]>0.7) imp+=0.1;
  if(pattern.marketState[3]>0.8) imp+=0.1;
  if(pattern.confidence>0.8)     imp+=0.1;
  return MathMin(2.0, imp);
}

double CalculatePatternConfidence(AIPattern &pattern)
{
  double c=0.5;
  c += MathMin(0.3, MathAbs(pattern.profitLoss)*10.0);
  if(pattern.marketState[1]>0.7) c+=0.1;
  if(pattern.marketState[3]>0.8) c+=0.1;
  if(pattern.marketState[4]>0.6) c+=0.05;
  return MathMin(1.0, c);
}

bool GenerateAIEnhancedBuySignal(double emaFast, double emaSlow, double rsi, double macdMain, double macdSignal, double atr, double vwap, AIDecision &aiDecision)
{
  bool tradi = GenerateEnhancedBuySignal(emaFast, emaSlow, rsi, macdMain, macdSignal, atr, vwap);
  if(UseAI_Level1 && aiDecision.confidence>=adaptiveParams.currentConfidenceThreshold){
    if(aiDecision.action=="BUY"){ Print("🤖 AI supports BUY"); return tradi; }
    else if(aiDecision.action=="SELL"){ Print("⚠️ AI contradicts BUY — blocked."); return false; }
  }
  return tradi;
}

bool GenerateAIEnhancedSellSignal(double emaFast, double emaSlow, double rsi, double macdMain, double macdSignal, double atr, double vwap, AIDecision &aiDecision)
{
  bool tradi = GenerateEnhancedSellSignal(emaFast, emaSlow, rsi, macdMain, macdSignal, atr, vwap);
  if(UseAI_Level1 && aiDecision.confidence>=adaptiveParams.currentConfidenceThreshold){
    if(aiDecision.action=="SELL"){ Print("🤖 AI supports SELL"); return tradi; }
    else if(aiDecision.action=="BUY"){ Print("⚠️ AI contradicts SELL — blocked."); return false; }
  }
  return tradi;
}

bool ValidateAITradeSetup(string direction, AIDecision &aiDecision)
{
  if(!ValidateTradeSetup(direction)) return false;

  if(UseAI_Level1){
    if(aiDecision.confidence < adaptiveParams.currentConfidenceThreshold) return false;
    if(aiDecision.qualityScore < 0.30) return false;
    if(MathAbs(aiDecision.expectedReturn) < 0.30) return false;
    if(aiDecision.riskScore > 0.80) return false;
  }
  return true;
}

void ExecuteAIEnhancedTrade(string type, AIDecision &aiDecision)
{
  double baseLot = CalculateEnhancedLotSize();
  double aiLot   = baseLot;

  if(UseAI_Level1 && aiDecision.confidence>0.0){
    double cMul = 0.4 + (aiDecision.confidence*0.6);
    double qMul = 0.5 + (aiDecision.qualityScore*0.5);
    aiLot = baseLot * cMul * qMul;
  }

  double slP=SL_Pips, tpP=TP_Pips;
  if(UseAI_Level1){
    double retMul = 1.0 + (aiDecision.expectedReturn/200.0);
    tpP = TP_Pips * MathMax(0.7, MathMin(1.8, retMul));
    double slMul = 1.0 + (1.0-aiDecision.confidence)*0.3;
    slP = SL_Pips * slMul;
  }

  double ask=SymbolInfoDouble(_Symbol, SYMBOL_ASK);
  double bid=SymbolInfoDouble(_Symbol, SYMBOL_BID);

  double price, sl, tp;
  if(type=="BUY"){ price=ask; sl=ask - slP*Pip(); tp=ask + tpP*Pip(); }
  else           { price=bid; sl=bid + slP*Pip(); tp=bid - tpP*Pip(); }

  lastEntryTime=TimeCurrent();
  dailyRiskUsed += lastRiskCalc.finalRisk;

  int len=adaptiveParams.currentLearningPeriod*2; if(len<=0) len=100;
  aiLearningHistory[learningIndex]=0.0; learningIndex=(learningIndex+1)%len;

  double minLot=SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
  double step  =SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
  if(step<=0.0) step=0.01;
  aiLot = MathMax(minLot, MathFloor(aiLot/step)*step);

  string comment = StringFormat("AI_%s_%.2f", type, aiDecision.confidence);
  Print("🚀 Opening ", type, " Lot:", DoubleToString(aiLot,2),
        " | AI Conf:", DoubleToString(aiDecision.confidence,2));

  if(aiLot>=minLot){
    if(type=="BUY")  trade.Buy (aiLot, _Symbol, price, sl, tp, comment);
    if(type=="SELL") trade.Sell(aiLot, _Symbol, price, sl, tp, comment);
  }

  trendLockedDirection = type;
  trendLockStartTime   = TimeCurrent();
}

// ===================== TRADE TRANSACTIONS =========================
void OnTradeTransaction(const MqlTradeTransaction& trans, const MqlTradeRequest& request, const MqlTradeResult& result)
{
  if(trans.type == TRADE_TRANSACTION_DEAL_ADD){
    if(HistoryDealSelect(trans.deal)){
      string symbol = HistoryDealGetString(trans.deal, DEAL_SYMBOL);
      long magic    = HistoryDealGetInteger(trans.deal, DEAL_MAGIC);
      long entry    = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
      if(symbol==_Symbol && magic==MagicNumber && entry==DEAL_ENTRY_OUT){
        double profit = HistoryDealGetDouble(trans.deal, DEAL_PROFIT);
        AddTradeResult(profit);
        if(UseAI_Level1 || UseAI_Level2){
          int len=adaptiveParams.currentLearningPeriod*2; if(len<=0) len=100;
          aiLearningHistory[learningIndex]=profit;
          learningIndex=(learningIndex+1)%len;
        }
        Print("📈 Trade closed. P/L=", DoubleToString(profit,2), " | AI learning updated.");
      }
    }
  }
}

// ============================ TIMER ===============================
void OnTimer()
{
  static datetime lastStatus=0;
  if(TimeCurrent()-lastStatus>3600){
    if(UseMTFConfluence){
      Print("🔍 MTF: Score=", DoubleToString(currentConfluence.overallScore,2),
            " Trend=", currentConfluence.trendDirection,
            " Strength=", DoubleToString(currentConfluence.trendStrength,2));
    }
    if(UseDynamicRisk){
      Print("💰 Risk: Base=", DoubleToString(lastRiskCalc.baseRisk,2), "% Final=", DoubleToString(lastRiskCalc.finalRisk,2),
            "% | WinRate=", DoubleToString(riskMetrics.recentWinRate,1), "%");
    }
    if(UseAI_Level1 || UseAI_Level2){
      Print("🤖 AI: Patterns=", aiPatternCount, " Trades=", aiTradeCount,
            " Perf=", DoubleToString(adaptiveParams.performanceScore,2));
      if(aiWinningTrades+aiLosingTrades>0){
        double wr = (double)aiWinningTrades/(aiWinningTrades+aiLosingTrades)*100.0;
        Print("   AI WR=", DoubleToString(wr,1), "%");
      }
    }
    lastStatus=TimeCurrent();
  }
}

// ============================ DEINIT ==============================
void OnDeinit(const int reason)
{
  DeleteDashboard();
  Print("🔄 ZoneX Bot Deinit");
  Print("📊 WinRate:", DoubleToString(metrics.winRate,1), "% PF:", DoubleToString(metrics.profitFactor,2),
        " Trades:", metrics.totalTrades);

  if(UseMTFConfluence){
    Print("📈 MTF Confluence enabled. Final Score:", DoubleToString(currentConfluence.overallScore,2),
          " Trend:", currentConfluence.trendDirection);
  }
  if(UseDynamicRisk){
    Print("💰 Dynamic Risk: FinalRisk=", DoubleToString(lastRiskCalc.finalRisk,2), "% | Reason=", lastRiskCalc.reasoning);
  }
  if(UseAI_Level1 || UseAI_Level2){
    Print("🤖 AI FINAL: L1:", UseAI_Level1, " L2:", UseAI_Level2,
          " Patterns:", aiPatternCount, " AI Trades:", aiTradeCount,
          " PerfScore:", DoubleToString(aiPerformanceScore,3));
    if(AI_AdaptiveParameters){
      Print("   Adaptive: Conf0=", DoubleToString(AI_ConfidenceThreshold,2),
            " ConfF=", DoubleToString(adaptiveParams.currentConfidenceThreshold,2),
            " Perf=", DoubleToString(adaptiveParams.performanceScore,3));
    }
    if(aiWinningTrades+aiLosingTrades>0){
      double wr=(double)aiWinningTrades/(aiWinningTrades+aiLosingTrades)*100.0;
      Print("   AI WR:", DoubleToString(wr,1), "% Profit:", DoubleToString(aiTotalProfit,2),
            " Loss:", DoubleToString(aiTotalLoss,2));
    }
  }
  Print("🎉 Session End");
}
//+------------------------------------------------------------------+
