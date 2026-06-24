/**
 * @react-pdf/renderer document component.
 * Server-side only - only imported by the export API route.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ResearchReport } from "@/lib/ai/schemas";

const C = {
  accent:   "#6366f1",
  text:     "#111827",
  muted:    "#6b7280",
  border:   "#e5e7eb",
  surface:  "#f9fafb",
  positive: "#16a34a",
  negative: "#dc2626",
  warn:     "#d97706",
} as const;

const styles = StyleSheet.create({
  page:      { fontFamily: "Helvetica", backgroundColor: "#ffffff", paddingHorizontal: 44, paddingTop: 36, paddingBottom: 52, fontSize: 9, color: C.text },
  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  brand:     { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.accent, letterSpacing: 1 },
  headerMeta:{ fontSize: 7.5, color: C.muted, textAlign: "right" },
  title:     { fontSize: 17, fontFamily: "Helvetica-Bold", color: C.text, marginBottom: 4, letterSpacing: -0.3 },
  queryText: { fontSize: 8.5, color: C.muted, marginBottom: 18 },
  summaryBox:{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 13, marginBottom: 20 },
  summaryText:{ fontSize: 9, lineHeight: 1.65, color: C.text },
  section:   { marginBottom: 20 },
  sectionH:  { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.text, marginBottom: 7, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  card:      { borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 10, marginBottom: 7 },
  cardTicker:{ fontSize: 12, fontFamily: "Helvetica-Bold", color: C.text },
  cardName:  { fontSize: 8, color: C.muted, marginBottom: 5 },
  metricsRow:{ flexDirection: "row", marginBottom: 7 },
  metricBox: { marginRight: 16 },
  metricLbl: { fontSize: 7, color: C.muted },
  metricVal: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.text },
  overview:  { fontSize: 8, color: C.muted, lineHeight: 1.5 },
  tblHdr:    { flexDirection: "row", backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: "#d1d5db", paddingVertical: 4, paddingHorizontal: 3 },
  tblHdrCell:{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.muted },
  tblRow:    { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 4, paddingHorizontal: 3 },
  tblCell:   { fontSize: 8, color: C.text },
  riskRow:   { borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 6, paddingHorizontal: 3 },
  riskTitle: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  riskLabel: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.text, flex: 1 },
  riskRat:   { fontSize: 8, color: C.muted, lineHeight: 1.45 },
  footer:    { position: "absolute", bottom: 22, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 7 },
  footerText:{ fontSize: 7, color: C.muted },
});

const SENTIMENT_COLOR: Record<string, string> = { positive: C.positive, negative: C.negative, neutral: C.muted };
const SEVERITY_COLOR:  Record<string, string> = { high: C.negative, medium: C.warn, low: C.positive };

function fmtNum(val: number | null | undefined, prefix = "", suffix = "", big = false): string {
  if (val == null) return "-";
  if (big) {
    if (Math.abs(val) >= 1e9) return `${prefix}${(val / 1e9).toFixed(1)}B${suffix}`;
    if (Math.abs(val) >= 1e6) return `${prefix}${(val / 1e6).toFixed(0)}M${suffix}`;
  }
  return `${prefix}${val.toFixed(2)}${suffix}`;
}

interface Props {
  title: string;
  query: string;
  report: ResearchReport;
}

export function ReportPdfDocument({ title, query, report: r }: Props) {
  const dateStr = new Date(r.meta.generated_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <Document title={title} author="Klypup" creator="Klypup Research Platform">
      <Page size="A4" style={styles.page}>

        {/* Header (fixed - repeats on each page) */}
        <View style={styles.header} fixed>
          <Text style={styles.brand}>KLYPUP</Text>
          <Text style={styles.headerMeta}>{dateStr}{"\n"}Tools: {r.tools_used.join(", ")}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.queryText}>Query: {query}</Text>

        {/* Executive Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{r.summary}</Text>
        </View>

        {/* Companies */}
        {r.companies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionH}>Companies ({r.companies.length})</Text>
            {r.companies.map((co) => {
              const chg = co.metrics.price_change_1d;
              const chgColor = chg != null && chg >= 0 ? C.positive : C.negative;
              return (
                <View key={co.ticker} style={styles.card}>
                  <Text style={styles.cardTicker}>{co.ticker}</Text>
                  <Text style={styles.cardName}>{co.name}</Text>
                  <View style={styles.metricsRow}>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLbl}>Price</Text>
                      <Text style={styles.metricVal}>{fmtNum(co.metrics.current_price, "$")}</Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLbl}>Change (1d)</Text>
                      <Text style={[styles.metricVal, { color: chgColor }]}>
                        {chg != null && chg >= 0 ? "+" : ""}{fmtNum(chg, "", "%")}
                      </Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLbl}>Market Cap</Text>
                      <Text style={styles.metricVal}>{fmtNum(co.metrics.market_cap, "$", "", true)}</Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLbl}>P/E</Text>
                      <Text style={styles.metricVal}>{fmtNum(co.metrics.pe_ratio)}</Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLbl}>Rev (TTM)</Text>
                      <Text style={styles.metricVal}>{fmtNum(co.metrics.revenue_ttm, "$", "", true)}</Text>
                    </View>
                  </View>
                  <Text style={styles.overview}>{co.overview}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* News */}
        {r.news.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionH}>News ({r.news.length})</Text>
            <View style={styles.tblHdr}>
              <Text style={[styles.tblHdrCell, { width: "48%" }]}>Headline</Text>
              <Text style={[styles.tblHdrCell, { width: "13%" }]}>Sentiment</Text>
              <Text style={[styles.tblHdrCell, { width: "22%" }]}>Source</Text>
              <Text style={[styles.tblHdrCell, { width: "17%" }]}>Date</Text>
            </View>
            {r.news.map((item, i) => (
              <View key={i} style={styles.tblRow}>
                <Text style={[styles.tblCell, { width: "48%" }]}>{item.headline}</Text>
                <Text style={[styles.tblCell, { width: "13%", color: SENTIMENT_COLOR[item.sentiment] ?? C.muted }]}>
                  {item.sentiment}
                </Text>
                <Text style={[styles.tblCell, { width: "22%" }]}>{item.source}</Text>
                <Text style={[styles.tblCell, { width: "17%" }]}>
                  {new Date(item.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Risks */}
        {r.risks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionH}>Risks ({r.risks.length})</Text>
            {r.risks.map((risk, i) => (
              <View key={i} style={styles.riskRow}>
                <View style={styles.riskTitle}>
                  <Text style={styles.riskLabel}>{risk.risk}</Text>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: SEVERITY_COLOR[risk.severity] ?? C.muted }}>
                    {risk.severity.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.riskRat}>{risk.rationale}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer (fixed - repeats on each page) */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Klypup Research Platform</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>

      </Page>
    </Document>
  );
}
