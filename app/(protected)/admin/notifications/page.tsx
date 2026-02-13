"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { format } from "date-fns";
import QRCode from "qrcode";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  IconBell,
  IconInfoCircle,
  IconCheck,
  IconAlertTriangle,
  IconAlertCircle,
  IconClock,
  IconArrowRight,
  IconWorldWww,
  IconQrcode,
  IconScan,
  IconTrendingUp,
  IconCalendar,
  IconDeviceMobile,
  IconDownload,
  IconRefresh,
  IconChartBar,
} from "@tabler/icons-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { TablePageSkeleton } from "@/components/skeletons";

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
  relatedId?: string;
  link?: string;
}

interface QrStats {
  totalScans: number;
  scansToday: number;
  scansThisWeek: number;
  scansThisMonth: number;
  dailyScans: { date: string; scans: number }[];
  recentScans: { _id: string; scannedAt: string; ip: string; userAgent: string }[];
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("updates");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrStats, setQrStats] = useState<QrStats | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [chartRange, setChartRange] = useState<7 | 30 | 90>(7);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setLeftContent } = useHeaderActions();

  useEffect(() => {
    setLeftContent(
      <div className="flex items-center gap-2">
        <IconBell className="h-5 w-5" />
        <h1 className="text-xl font-bold">Notifications</h1>
      </div>
    );
    return () => setLeftContent(null);
  }, [setLeftContent]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/admin/notifications");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (error) {
        console.error("Failed to fetch notifications", error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const generateQrCode = useCallback(async () => {
    try {
      // QR encodes the Vercel URL where the tracking API lives; it redirects to vidabuddies.com
      const trackingUrl = "https://vida-buddies-erp.vercel.app/api/qr-scan";

      // Generate QR code at 4000x4000 for print quality (300 PPI = ~13.3 inches)
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, trackingUrl, {
        width: 4000,
        margin: 2,
        color: {
          dark: "#09090b",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H", // High error correction to allow logo overlay
      });

      // Draw logo on top of QR code
      const ctx = qrCanvas.getContext("2d");
      if (ctx) {
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.src = "/logo.png";
        await new Promise<void>((resolve, reject) => {
          logo.onload = () => {
            const logoSize = qrCanvas.width * 0.22;
            const x = (qrCanvas.width - logoSize) / 2;
            const y = (qrCanvas.height - logoSize) / 2;

            // White circle background behind the logo
            ctx.beginPath();
            ctx.arc(
              qrCanvas.width / 2,
              qrCanvas.height / 2,
              logoSize * 0.62,
              0,
              Math.PI * 2
            );
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            // Draw a subtle border around the logo area
            ctx.beginPath();
            ctx.arc(
              qrCanvas.width / 2,
              qrCanvas.height / 2,
              logoSize * 0.64,
              0,
              Math.PI * 2
            );
            ctx.strokeStyle = "#e4e4e7";
            ctx.lineWidth = 20;
            ctx.stroke();

            // Draw the logo
            ctx.drawImage(logo, x, y, logoSize, logoSize);
            resolve();
          };
          logo.onerror = () => {
            // If logo fails to load, still show QR without logo
            resolve();
          };
        });
      }

      // Store the raw data URL (display preview)
      setQrDataUrl(qrCanvas.toDataURL("image/png"));
    } catch (error) {
      console.error("Failed to generate QR code:", error);
    }
  }, []);

  const fetchQrStats = useCallback(async (days: number = 7) => {
    setQrLoading(true);
    try {
      const res = await fetch(`/api/admin/qr-stats?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setQrStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch QR stats:", error);
    } finally {
      setQrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "traffic") {
      generateQrCode();
      fetchQrStats(chartRange);
    }
  }, [activeTab, chartRange, generateQrCode, fetchQrStats]);

  // Inject pHYs chunk into PNG binary to set 300 PPI metadata
  const setPngDpi = (dataUrl: string, dpi: number): string => {
    // Convert data URL to binary
    const base64 = dataUrl.split(",")[1];
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    // 300 DPI = 11811 pixels per meter (1 inch = 0.0254m → 300/0.0254 ≈ 11811)
    const ppm = Math.round(dpi / 0.0254);

    // Build the pHYs chunk: 4-byte length + 4-byte type + 9-byte data + 4-byte CRC
    const phys = new Uint8Array(21);
    const view = new DataView(phys.buffer);
    // Length of data section = 9
    view.setUint32(0, 9);
    // Chunk type: "pHYs"
    phys[4] = 0x70; phys[5] = 0x48; phys[6] = 0x59; phys[7] = 0x73;
    // Pixels per unit X
    view.setUint32(8, ppm);
    // Pixels per unit Y
    view.setUint32(12, ppm);
    // Unit = meter
    phys[16] = 1;
    // CRC32 over type + data
    const crc = crc32(phys.slice(4, 17));
    view.setUint32(17, crc);

    // Find the first IDAT chunk and insert pHYs before it
    // PNG signature is 8 bytes, then chunks follow
    let offset = 8;
    while (offset < bytes.length) {
      const chunkLen = (bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3];
      const chunkType = String.fromCharCode(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);
      if (chunkType === "IDAT" || chunkType === "pHYs") {
        // If there's already a pHYs, skip past it
        if (chunkType === "pHYs") {
          offset += 12 + chunkLen;
          continue;
        }
        break;
      }
      offset += 12 + chunkLen; // 4 len + 4 type + data + 4 crc
    }

    // Combine: before IDAT + pHYs + IDAT onwards
    const result = new Uint8Array(bytes.length + 21);
    result.set(bytes.slice(0, offset), 0);
    result.set(phys, offset);
    result.set(bytes.slice(offset), offset + 21);

    // Convert back to data URL
    let binary = "";
    for (let i = 0; i < result.length; i++) binary += String.fromCharCode(result[i]);
    return "data:image/png;base64," + btoa(binary);
  };

  // CRC32 implementation for PNG chunk checksum
  const crc32 = (data: Uint8Array): number => {
    let crc = 0xFFFFFFFF;
    const table: number[] = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };

  const downloadQrCode = () => {
    if (!qrDataUrl) return;
    // Inject 300 PPI metadata into PNG before download
    const hiDpiDataUrl = setPngDpi(qrDataUrl, 300);
    const link = document.createElement("a");
    link.download = "vida-buddies-qr-code.png";
    link.href = hiDpiDataUrl;
    link.click();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <IconCheck className="h-5 w-5 text-green-500" />;
      case "warning":
        return <IconAlertTriangle className="h-5 w-5 text-amber-500" />;
      case "error":
        return <IconAlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <IconInfoCircle className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 border-green-200 dark:border-green-900";
      case "warning":
        return "bg-amber-500/10 border-amber-200 dark:border-amber-900";
      case "error":
        return "bg-red-500/10 border-red-200 dark:border-red-900";
      default:
        return "bg-blue-500/10 border-blue-200 dark:border-blue-900";
    }
  };

  const scanChartConfig = {
    scans: {
      label: "Scans",
      color: "var(--primary)",
    },
  } satisfies ChartConfig;

  const totalChartScans = useMemo(() => {
    if (!qrStats?.dailyScans) return 0;
    return qrStats.dailyScans.reduce((acc, d) => acc + d.scans, 0);
  }, [qrStats?.dailyScans]);

  if (loading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="container max-w-5xl mx-auto p-6 space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="updates" className="gap-1.5">
            <IconBell className="h-4 w-4" />
            Updates
          </TabsTrigger>
          <TabsTrigger value="traffic" className="gap-1.5">
            <IconWorldWww className="h-4 w-4" />
            Website Traffic
          </TabsTrigger>
        </TabsList>

        {/* ── Updates Tab ── */}
        <TabsContent value="updates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent Updates</span>
                <Badge variant="secondary">{notifications.length} Unread</Badge>
              </CardTitle>
              <CardDescription>
                Stay updated with the latest shipment changes and alerts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <IconBell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No new notifications</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {notifications.map((notification) => (
                      <div
                        key={notification._id}
                        className={`flex gap-4 p-4 rounded-xl border transition-all hover:bg-muted/50 ${
                          !notification.read
                            ? "bg-background shadow-sm"
                            : "opacity-70 grayscale"
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getTypeStyles(
                            notification.type
                          )}`}
                        >
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start justify-between">
                            <h4 className="font-semibold text-sm">
                              {notification.title}
                            </h4>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <IconClock className="h-3 w-3 mr-1" />
                              {format(
                                new Date(notification.createdAt),
                                "MMM d, h:mm a"
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {notification.message}
                          </p>
                          {notification.link && (
                            <div className="pt-2">
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto text-xs"
                                asChild
                              >
                                <Link href={notification.link}>
                                  View Details{" "}
                                  <IconArrowRight className="ml-1 h-3 w-3" />
                                </Link>
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Website Traffic Tab ── */}
        <TabsContent value="traffic">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* QR Code Card */}
            <Card className="lg:row-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconQrcode className="h-5 w-5" />
                  QR Code
                </CardTitle>
                <CardDescription>
                  Scan this QR code to visit vidabuddies.com — every scan is tracked.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6">
                {/* QR Code Display */}
                <div className="relative group">
                  <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-green-500/20 to-emerald-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative bg-white p-6 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Vida Buddies QR Code"
                        className="w-64 h-64 object-contain"
                      />
                    ) : (
                      <div className="w-64 h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Tracking URL info */}
                <div className="text-center space-y-2 w-full">
                  <p className="text-xs text-muted-foreground">
                    Points to: <span className="font-mono text-foreground">/api/qr-scan</span> → redirects to{" "}
                    <span className="font-mono text-foreground">vidabuddies.com</span>
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 w-full">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={downloadQrCode}
                    disabled={!qrDataUrl}
                  >
                    <IconDownload className="h-4 w-4 mr-2" />
                    Download PNG
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      generateQrCode();
                      fetchQrStats();
                    }}
                  >
                    <IconRefresh className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                <canvas ref={canvasRef} className="hidden" />
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-3xl" />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <IconScan className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {qrLoading ? "—" : qrStats?.totalScans ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Scans</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-green-500/10 to-transparent rounded-bl-3xl" />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <IconTrendingUp className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {qrLoading ? "—" : qrStats?.scansToday ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Today</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-3xl" />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <IconCalendar className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {qrLoading ? "—" : qrStats?.scansThisWeek ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">This Week</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-bl-3xl" />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <IconDeviceMobile className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {qrLoading ? "—" : qrStats?.scansThisMonth ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">This Month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Daily Scans Area Chart */}
            <Card className="@container/chart">
              <CardHeader>
                <CardTitle className="flex items-baseline gap-2">
                  Daily Scans
                  <span className="text-sm font-normal text-muted-foreground">
                    {totalChartScans.toLocaleString()}
                  </span>
                </CardTitle>
                <CardAction>
                  <ToggleGroup
                    type="single"
                    value={String(chartRange)}
                    onValueChange={(v) => v && setChartRange(Number(v) as 7 | 30 | 90)}
                    variant="outline"
                    className="hidden *:data-[slot=toggle-group-item]:!px-4 @[500px]/chart:flex"
                  >
                    <ToggleGroupItem value="7">Last 7 days</ToggleGroupItem>
                    <ToggleGroupItem value="30">Last 30 days</ToggleGroupItem>
                    <ToggleGroupItem value="90">Last 3 months</ToggleGroupItem>
                  </ToggleGroup>
                  <Select
                    value={String(chartRange)}
                    onValueChange={(v) => setChartRange(Number(v) as 7 | 30 | 90)}
                  >
                    <SelectTrigger
                      className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[500px]/chart:hidden"
                      size="sm"
                      aria-label="Select range"
                    >
                      <SelectValue placeholder="Last 7 days" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="7" className="rounded-lg">Last 7 days</SelectItem>
                      <SelectItem value="30" className="rounded-lg">Last 30 days</SelectItem>
                      <SelectItem value="90" className="rounded-lg">Last 3 months</SelectItem>
                    </SelectContent>
                  </Select>
                </CardAction>
              </CardHeader>
              <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                {qrLoading ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-500" />
                  </div>
                ) : (
                  <ChartContainer
                    id="qr-scans-area-chart"
                    config={scanChartConfig}
                    className="aspect-auto h-[250px] w-full"
                    style={{ minWidth: "100%", minHeight: "250px" }}
                  >
                    <AreaChart
                      data={qrStats?.dailyScans ?? []}
                      margin={{ left: 12, right: 12 }}
                    >
                      <defs>
                        <linearGradient id="fillScans" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-scans)" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="var(--color-scans)" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={32}
                        tickFormatter={(value) => {
                          const d = new Date(value + "T12:00:00");
                          return chartRange <= 7
                            ? format(d, "EEE")
                            : format(d, "MMM d");
                        }}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            labelFormatter={(value) =>
                              format(new Date(value + "T12:00:00"), "EEE, MMM d, yyyy")
                            }
                            indicator="dot"
                          />
                        }
                      />
                      <Area
                        dataKey="scans"
                        type="natural"
                        fill="url(#fillScans)"
                        stroke="var(--color-scans)"
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Recent Scans */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <IconClock className="h-4 w-4" />
                  Recent Scans
                </CardTitle>
                <CardDescription>
                  Last 10 QR code scans with device information.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {qrLoading ? (
                  <div className="h-32 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-500" />
                  </div>
                ) : qrStats?.recentScans && qrStats.recentScans.length > 0 ? (
                  <div className="space-y-2">
                    {qrStats.recentScans.map((scan) => {
                      // Parse user agent for a friendlier display
                      const isMobile = /mobile|android|iphone/i.test(scan.userAgent);
                      const deviceLabel = isMobile ? "📱 Mobile" : "💻 Desktop";
                      return (
                        <div
                          key={scan._id}
                          className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm">{deviceLabel}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {scan.ip?.substring(0, 20)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(scan.scannedAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <IconScan className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No scans recorded yet</p>
                    <p className="text-xs mt-1">
                      Share your QR code to start tracking visits
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
