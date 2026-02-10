import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "../adapters";
import { Alert, AlertDescription, AlertTitle } from "@/src/features/agents/components/ui/alert";
import { Button } from "@/src/features/agents/components/ui/button";
import {
    ShieldCheck,
    Renew,
    Terminal,
    Copy,
    Download,
    CheckCircle,
    XCircle,
    Clock,
    ChevronRight,
    ChevronDown,
} from "@/src/features/agents/components/ui/icon-bridge";
import { CompactTable } from "@/src/features/agents/components/ui/CompactTable";
import { SearchBar } from "@/src/features/agents/components/ui/SearchBar";
import { Badge } from "@/src/features/agents/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectSeparator,
} from "@/src/features/agents/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/src/features/agents/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/src/features/agents/components/ui/dialog";
import { Input } from "@/src/features/agents/components/ui/input";
import * as identityApi from "../services/identityApi";
import type { VCSearchResult } from "../services/identityApi";
import { formatRelativeTime } from "../utils/dateFormat";

const ITEMS_PER_PAGE = 50;
const GRID_TEMPLATE =
    "60px minmax(200px,1.8fr) minmax(220px,2fr) minmax(180px,1.5fr) minmax(100px,0.7fr) 60px";

// Helper function to truncate DID smartly
const truncateDID = (did: string): string => {
    if (!did || did.length <= 20) return did;
    const start = did.substring(0, 15);
    const end = did.substring(did.length - 8);
    return `${start}...${end}`;
};

// Time filter options
const TIME_FILTER_OPTIONS = [
    { value: "1h", label: "1h" },
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
    { value: "30d", label: "30d" },
    { value: "custom", label: "Custom" },
    { value: "all", label: "All Time" },
];

export function CredentialsPage() {
    const navigate = useNavigate();

    const formatInputValue = useCallback((date: Date) => {
        const pad = (value: number) => value.toString().padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }, []);

    // State
    const [credentials, setCredentials] = useState<VCSearchResult[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [timeRange, setTimeRange] = useState("24h");
    const [previousTimeRange, setPreviousTimeRange] = useState("24h");
    const [verificationFilter, setVerificationFilter] = useState("all");
    const [customRange, setCustomRange] = useState<{
        start?: string;
        end?: string;
    }>({});
    const [customRangeDraft, setCustomRangeDraft] = useState<{
        start?: string;
        end?: string;
    }>({});
    const [customRangeError, setCustomRangeError] = useState<string | null>(
        null,
    );
    const [showCustomRangeDialog, setShowCustomRangeDialog] = useState(false);
    const [selectedCredential, setSelectedCredential] =
        useState<VCSearchResult | null>(null);

    // Loading states
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Pagination
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);

    const [error, setError] = useState<string | null>(null);
    const [showVCJson, setShowVCJson] = useState(false);
    const [copiedText, setCopiedText] = useState<string | null>(null);
    const customRangeAppliedRef = useRef(false);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            setDebouncedQuery(searchQuery.trim());
        }, 350);
        return () => window.clearTimeout(handle);
    }, [searchQuery]);

    // Compute time range for API
    const getTimeRangeParams = useCallback(
        (range: string) => {
            if (range === "all") return {};
            if (range === "custom") {
                if (customRange.start && customRange.end) {
                    const startDate = new Date(customRange.start);
                    const endDate = new Date(customRange.end);
                    if (
                        !Number.isNaN(startDate.getTime()) &&
                        !Number.isNaN(endDate.getTime())
                    ) {
                        return {
                            start_time: startDate.toISOString(),
                            end_time: endDate.toISOString(),
                        };
                    }
                }
                return {};
            }

            const now = new Date();
            const ranges: Record<string, number> = {
                "1h": 60 * 60 * 1000,
                "24h": 24 * 60 * 60 * 1000,
                "7d": 7 * 24 * 60 * 60 * 1000,
                "30d": 30 * 24 * 60 * 60 * 1000,
            };

            const ms = ranges[range];
            if (!ms) return {};
            const startTime = new Date(now.getTime() - ms);
            return {
                start_time: startTime.toISOString(),
                end_time: now.toISOString(),
            };
        },
        [customRange],
    );

    const openCustomRangeDialog = useCallback(() => {
        setCustomRangeError(null);
        if (customRange.start && customRange.end) {
            setCustomRangeDraft({ ...customRange });
        } else {
            const now = new Date();
            const fallbackStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            setCustomRangeDraft({
                start: formatInputValue(fallbackStart),
                end: formatInputValue(now),
            });
        }
        setShowCustomRangeDialog(true);
    }, [customRange, formatInputValue]);

    const handleTimeRangeChange = useCallback(
        (value: string) => {
            if (value === "custom") {
                setPreviousTimeRange((prev) =>
                    timeRange === "custom" ? prev : timeRange,
                );
                setTimeRange("custom");
                openCustomRangeDialog();
                return;
            }
            setCustomRange({});
            setTimeRange(value);
            setPreviousTimeRange(value);
        },
        [openCustomRangeDialog, timeRange],
    );

    const handleCustomRangeDraftChange = useCallback(
        (field: "start" | "end", value: string) => {
            setCustomRangeDraft((prev) => ({
                ...prev,
                [field]: value,
            }));
        },
        [],
    );

    const handleCustomRangeApply = useCallback(() => {
        if (!customRangeDraft.start || !customRangeDraft.end) {
            setCustomRangeError("Start and end time are required.");
            return;
        }
        const startDate = new Date(customRangeDraft.start);
        const endDate = new Date(customRangeDraft.end);
        if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime())
        ) {
            setCustomRangeError("Please provide valid dates.");
            return;
        }
        if (endDate <= startDate) {
            setCustomRangeError("End time must be after start time.");
            return;
        }
        setCustomRange({ ...customRangeDraft });
        customRangeAppliedRef.current = true;
        setShowCustomRangeDialog(false);
        setCustomRangeError(null);
        setTimeRange("custom");
        setPreviousTimeRange("custom");
    }, [customRangeDraft]);

    useEffect(() => {
        if (!showCustomRangeDialog) {
            if (customRangeAppliedRef.current) {
                customRangeAppliedRef.current = false;
                return;
            }
            setCustomRangeError(null);
            if (!customRange.start || !customRange.end) {
                setTimeRange(previousTimeRange);
            }
        }
    }, [customRange, previousTimeRange, showCustomRangeDialog]);

    // Fetch credentials
    const fetchCredentials = useCallback(
        async (newOffset: number = 0, reset: boolean = true) => {
            try {
                if (reset) {
                    setLoading(true);
                    setError(null);
                } else {
                    setLoadingMore(true);
                }

                const timeParams = getTimeRangeParams(timeRange);
                const queryParam =
                    debouncedQuery.length > 0 ? debouncedQuery : undefined;

                const data = await identityApi.searchCredentials({
                    ...timeParams,
                    query: queryParam,
                    status:
                        verificationFilter === "all"
                            ? undefined
                            : verificationFilter,
                    limit: ITEMS_PER_PAGE,
                    offset: newOffset,
                });

                const results = data.credentials || [];

                if (reset) {
                    setCredentials(results);
                } else {
                    setCredentials((prev) => [...prev, ...results]);
                }

                const totalCount = data.total || 0;
                setTotal(totalCount);
                const computedHasMore =
                    typeof data.has_more === "boolean"
                        ? data.has_more
                        : totalCount > newOffset + results.length;
                setHasMore(computedHasMore);
                setOffset(newOffset);
            } catch (err) {
                console.error("Failed to fetch credentials:", err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch credentials",
                );
                if (reset) {
                    setCredentials([]);
                }
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [debouncedQuery, timeRange, verificationFilter, getTimeRangeParams],
    );

    // Initial load and filter changes
    useEffect(() => {
        fetchCredentials(0, true);
    }, [fetchCredentials]);

    const visibleCredentials = credentials;

    // Handlers
    const handleRefresh = () => {
        fetchCredentials(0, true);
    };

    const handleLoadMore = () => {
        if (!hasMore || loadingMore) return;
        fetchCredentials(offset + ITEMS_PER_PAGE, false);
    };

    const handleCredentialClick = (credential: VCSearchResult) => {
        setSelectedCredential(credential);
        setShowVCJson(false);
    };

    const handleBackToList = () => {
        setSelectedCredential(null);
        setShowVCJson(false);
    };

    const handleCopy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedText(label);
            setTimeout(() => setCopiedText(null), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const handleDownloadVC = (vc: VCSearchResult) => {
        const dataStr = JSON.stringify(vc, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `vc-${vc.execution_id}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleExportCurrent = async () => {
        const dataStr = JSON.stringify(visibleCredentials, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `credentials-export-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Table columns - 6 columns with separate Execution ID and DID
    const columns = [
        {
            key: "status",
            header: "",
            sortable: false,
            align: "center" as const,
            render: (cred: VCSearchResult) => {
                const normalizedStatus =
                    cred.status?.toLowerCase() || "unknown";
                let badgeLabel = "Verified";
                let icon = <CheckCircle size={18} className="text-green-600" />;

                if (!cred.verified && normalizedStatus === "failed") {
                    badgeLabel = "Failed";
                    icon = <XCircle size={18} className="text-red-600" />;
                } else if (!cred.verified && normalizedStatus === "pending") {
                    badgeLabel = "Pending";
                    icon = <Clock size={18} className="text-amber-500" />;
                } else if (!cred.verified) {
                    badgeLabel =
                        normalizedStatus.charAt(0).toUpperCase() +
                        normalizedStatus.slice(1);
                    icon = (
                        <ShieldCheck
                            size={18}
                            className="text-muted-foreground"
                        />
                    );
                }

                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center justify-center cursor-help">
                                    {icon}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p>{badgeLabel}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            },
        },
        {
            key: "execution_id",
            header: "Execution ID",
            sortable: false,
            align: "left" as const,
            render: (cred: VCSearchResult) => (
                <TooltipProvider>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <code className="text-xs font-mono text-foreground truncate block flex-1 cursor-help">
                                    {cred.execution_id}
                                </code>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-md">
                                <p className="font-mono text-xs break-all">
                                    {cred.execution_id}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(cred.execution_id, "execution");
                            }}
                            title="Copy execution ID"
                        >
                            <Copy className="w-3 h-3" />
                        </Button>
                    </div>
                </TooltipProvider>
            ),
        },
        {
            key: "did",
            header: "DID",
            sortable: false,
            align: "left" as const,
            render: (cred: VCSearchResult) => (
                <TooltipProvider>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <code className="text-xs font-mono text-muted-foreground truncate block flex-1 cursor-help">
                                    {truncateDID(cred.issuer_did)}
                                </code>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-md">
                                <p className="font-mono text-xs break-all">
                                    {cred.issuer_did}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(cred.issuer_did, "did");
                            }}
                            title="Copy DID"
                        >
                            <Copy className="w-3 h-3" />
                        </Button>
                    </div>
                </TooltipProvider>
            ),
        },
        {
            key: "context",
            header: "Context",
            sortable: false,
            align: "left" as const,
            render: (cred: VCSearchResult) => (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 min-w-0 cursor-help">
                                {cred.agent_name && (
                                    <>
                                        <span className="text-sm truncate flex-shrink-0 max-w-[120px]">
                                            {cred.agent_name}
                                        </span>
                                        <span className="text-muted-foreground flex-shrink-0">
                                            →
                                        </span>
                                    </>
                                )}
                                <button
                                    className="text-sm text-primary hover:underline truncate flex-1 text-left"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(
                                            `/workflows/${cred.workflow_id}`,
                                        );
                                    }}
                                >
                                    {cred.workflow_name || cred.workflow_id}
                                </button>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-md">
                            <div className="space-y-1">
                                {cred.agent_name && (
                                    <p>
                                        <strong>Agent:</strong>{" "}
                                        {cred.agent_name}
                                    </p>
                                )}
                                <p>
                                    <strong>Workflow:</strong>{" "}
                                    {cred.workflow_name || cred.workflow_id}
                                </p>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ),
        },
        {
            key: "created_at",
            header: "Created",
            sortable: true,
            align: "left" as const,
            render: (cred: VCSearchResult) => {
                const createdDate = new Date(cred.created_at);
                return (
                    <span
                        className="text-sm text-muted-foreground whitespace-nowrap"
                        title={createdDate.toLocaleString()}
                    >
                        {formatRelativeTime(cred.created_at)}
                    </span>
                );
            },
        },
        {
            key: "actions",
            header: "",
            sortable: false,
            align: "center" as const,
            render: (cred: VCSearchResult) => (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadVC(cred);
                    }}
                    title="Download credential"
                >
                    <Download className="w-3.5 h-3.5" />
                </Button>
            ),
        },
    ];

    const timeRangeLabel = useMemo(
        () =>
            TIME_FILTER_OPTIONS.find((opt) => opt.value === timeRange)?.label ??
            "selected range",
        [timeRange],
    );

    const filtersActive = useMemo(
        () =>
            verificationFilter !== "all" ||
            timeRange !== "24h" ||
            Boolean(debouncedQuery),
        [debouncedQuery, timeRange, verificationFilter],
    );

    // Status filter options with icons

    return (
        <>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-heading-1 truncate">
                                Credentials
                            </h1>
                            <p className="mt-1 text-body text-muted-foreground">
                                {selectedCredential
                                    ? `Viewing credential for execution ${selectedCredential.execution_id}`
                                    : `Verifiable credentials for agent executions • ${total > 0 ? `Showing ${visibleCredentials.length} of ${total.toLocaleString()}` : "No credentials"} • ${timeRangeLabel}`}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            {!selectedCredential && timeRange === "all" && (
                                <Badge
                                    variant="outline"
                                    className="text-amber-700 border-amber-200 bg-amber-50"
                                >
                                    All time query
                                </Badge>
                            )}
                            {selectedCredential && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBackToList}
                                >
                                    ← Back to Credentials
                                </Button>
                            )}
                            {!selectedCredential &&
                                visibleCredentials.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleExportCurrent}
                                        className="flex items-center gap-2"
                                    >
                                        <Download size={14} />
                                        Export ({visibleCredentials.length})
                                    </Button>
                                )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={loading}
                                className="flex items-center gap-2"
                            >
                                <Renew
                                    size={14}
                                    className={loading ? "animate-spin" : ""}
                                />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Compact Single-Row Filter Bar */}
                    {!selectedCredential && (
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                            {/* Search - Flexible width */}
                            <div className="flex-1 min-w-[300px]">
                                <SearchBar
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    placeholder="Search by execution ID, agent, workflow, or DID..."
                                    wrapperClassName="w-full"
                                />
                            </div>

                            {/* Status Dropdown */}
                            <Select
                                value={verificationFilter}
                                onValueChange={setVerificationFilter}
                            >
                                <SelectTrigger className="w-full lg:w-[160px]">
                                    <SelectValue>
                                        <div className="flex items-center gap-2">
                                            {verificationFilter ===
                                                "verified" && (
                                                <>
                                                    <CheckCircle
                                                        size={14}
                                                        className="text-green-600"
                                                    />
                                                    <span>Verified</span>
                                                </>
                                            )}
                                            {verificationFilter ===
                                                "failed" && (
                                                <>
                                                    <XCircle
                                                        size={14}
                                                        className="text-red-600"
                                                    />
                                                    <span>Failed</span>
                                                </>
                                            )}
                                            {verificationFilter ===
                                                "pending" && (
                                                <>
                                                    <Clock
                                                        size={14}
                                                        className="text-amber-500"
                                                    />
                                                    <span>Pending</span>
                                                </>
                                            )}
                                            {verificationFilter === "all" && (
                                                <span>All Statuses</span>
                                            )}
                                        </div>
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        <div className="flex items-center gap-2">
                                            <span>All Statuses</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="verified">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle
                                                size={14}
                                                className="text-green-600"
                                            />
                                            <span>Verified</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="failed">
                                        <div className="flex items-center gap-2">
                                            <XCircle
                                                size={14}
                                                className="text-red-600"
                                            />
                                            <span>Failed</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="pending">
                                        <div className="flex items-center gap-2">
                                            <Clock
                                                size={14}
                                                className="text-amber-500"
                                            />
                                            <span>Pending</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Time Range Dropdown */}
                            <Select
                                value={timeRange}
                                onValueChange={handleTimeRangeChange}
                            >
                                <SelectTrigger className="w-full lg:w-[140px]">
                                    <SelectValue>
                                        <div className="flex items-center gap-2">
                                            <Clock size={14} />
                                            <span>{timeRangeLabel}</span>
                                        </div>
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1h">
                                        Last Hour
                                    </SelectItem>
                                    <SelectItem value="24h">
                                        Last 24 Hours
                                    </SelectItem>
                                    <SelectItem value="7d">
                                        Last 7 Days
                                    </SelectItem>
                                    <SelectItem value="30d">
                                        Last 30 Days
                                    </SelectItem>
                                    <SelectSeparator />
                                    <SelectItem value="custom">
                                        Custom Range...
                                    </SelectItem>
                                    <SelectItem value="all">
                                        All Time
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* Error Alert */}
                {error && (
                    <Alert variant="destructive">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Content */}
                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
                    {selectedCredential ? (
                        // Credential Detail View
                        <div className="bg-card border border-border rounded-lg p-6 overflow-y-auto">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck
                                        size={20}
                                        className="text-primary"
                                    />
                                    <div>
                                        <h2 className="text-lg font-semibold">
                                            Verifiable Credential
                                        </h2>
                                        <code className="text-xs text-muted-foreground font-mono mt-1 block">
                                            {selectedCredential.execution_id}
                                        </code>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            handleCopy(
                                                JSON.stringify(
                                                    selectedCredential,
                                                    null,
                                                    2,
                                                ),
                                                "json",
                                            )
                                        }
                                    >
                                        <Copy size={14} className="mr-2" />
                                        {copiedText === "json"
                                            ? "Copied!"
                                            : "Copy JSON"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            handleDownloadVC(selectedCredential)
                                        }
                                    >
                                        <Download size={14} className="mr-2" />
                                        Download
                                    </Button>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold">
                                        Execution Details
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">
                                                Execution ID:
                                            </span>
                                            <div className="font-mono text-xs mt-1 break-all">
                                                {
                                                    selectedCredential.execution_id
                                                }
                                            </div>
                                        </div>
                                        {selectedCredential.agent_name && (
                                            <div>
                                                <span className="text-muted-foreground">
                                                    Agent:
                                                </span>
                                                <div className="mt-1">
                                                    {
                                                        selectedCredential.agent_name
                                                    }
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-muted-foreground">
                                                Workflow:
                                            </span>
                                            <div
                                                className="mt-1 text-primary cursor-pointer hover:underline"
                                                onClick={() =>
                                                    navigate(
                                                        `/workflows/${selectedCredential.workflow_id}`,
                                                    )
                                                }
                                            >
                                                {selectedCredential.workflow_name ||
                                                    selectedCredential.workflow_id}
                                            </div>
                                        </div>
                                        {selectedCredential.session_id && (
                                            <div>
                                                <span className="text-muted-foreground">
                                                    Session:
                                                </span>
                                                <div className="font-mono text-xs mt-1">
                                                    {
                                                        selectedCredential.session_id
                                                    }
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-muted-foreground">
                                                Created:
                                            </span>
                                            <div className="mt-1">
                                                {formatRelativeTime(
                                                    selectedCredential.created_at,
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold">
                                        Verification
                                    </h3>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm">
                                            {selectedCredential.verified ? (
                                                <>
                                                    <CheckCircle
                                                        size={16}
                                                        className="text-green-600"
                                                    />
                                                    <span className="text-green-600 font-medium">
                                                        Signature Valid
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle
                                                        size={16}
                                                        className="text-red-600"
                                                    />
                                                    <span className="text-red-600 font-medium">
                                                        Not Verified
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">
                                                    Issuer DID:
                                                </span>
                                                <div className="font-mono text-xs mt-1 break-all">
                                                    {selectedCredential.issuer_did ||
                                                        "N/A"}
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-muted-foreground">
                                                    Target DID:
                                                </span>
                                                <div className="font-mono text-xs mt-1 break-all">
                                                    {selectedCredential.target_did ||
                                                        "N/A"}
                                                </div>
                                            </div>

                                            {selectedCredential.caller_did && (
                                                <div>
                                                    <span className="text-muted-foreground">
                                                        Caller DID:
                                                    </span>
                                                    <div className="font-mono text-xs mt-1 break-all">
                                                        {
                                                            selectedCredential.caller_did
                                                        }
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* VC JSON Document */}
                            <div className="border-t border-border pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold">
                                        W3C JSON-LD Document
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            setShowVCJson(!showVCJson)
                                        }
                                    >
                                        {showVCJson ? (
                                            <>
                                                <ChevronDown
                                                    size={14}
                                                    className="mr-1"
                                                />
                                                Collapse
                                            </>
                                        ) : (
                                            <>
                                                <ChevronRight
                                                    size={14}
                                                    className="mr-1"
                                                />
                                                Expand
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {showVCJson && (
                                    <div className="bg-muted rounded-lg p-4 overflow-x-auto">
                                        <pre className="text-xs font-mono">
                                            {JSON.stringify(
                                                selectedCredential,
                                                null,
                                                2,
                                            )}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Credentials List View
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <CompactTable
                                data={visibleCredentials}
                                loading={loading}
                                hasMore={hasMore}
                                isFetchingMore={loadingMore}
                                sortBy="created_at"
                                sortOrder="desc"
                                onSortChange={() => {}}
                                onLoadMore={handleLoadMore}
                                onRowClick={handleCredentialClick}
                                columns={columns}
                                gridTemplate={GRID_TEMPLATE}
                                emptyState={{
                                    title: debouncedQuery
                                        ? "No credentials match your search"
                                        : filtersActive
                                          ? "No credentials match your filters"
                                          : "No credentials yet",
                                    description: debouncedQuery
                                        ? "Try refining your search query or adjusting the time range."
                                        : filtersActive
                                          ? `No credentials found for the current filters (${timeRangeLabel.toLowerCase()}). Try clearing filters or expanding the range.`
                                          : "Credentials will appear here as new executions finish.",
                                    icon: (
                                        <ShieldCheck className="h-6 w-6 text-muted-foreground" />
                                    ),
                                }}
                                getRowKey={(cred) => cred.vc_id}
                            />
                        </div>
                    )}
                </div>
            </div>

            <Dialog
                open={showCustomRangeDialog}
                onOpenChange={setShowCustomRangeDialog}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Custom time range</DialogTitle>
                        <DialogDescription>
                            Choose the start and end timestamps to query
                            historical credentials within a specific window.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <label
                                htmlFor="custom-range-start"
                                className="text-sm font-medium text-muted-foreground"
                            >
                                Start time
                            </label>
                            <Input
                                id="custom-range-start"
                                type="datetime-local"
                                value={customRangeDraft.start ?? ""}
                                onChange={(event) =>
                                    handleCustomRangeDraftChange(
                                        "start",
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <label
                                htmlFor="custom-range-end"
                                className="text-sm font-medium text-muted-foreground"
                            >
                                End time
                            </label>
                            <Input
                                id="custom-range-end"
                                type="datetime-local"
                                value={customRangeDraft.end ?? ""}
                                onChange={(event) =>
                                    handleCustomRangeDraftChange(
                                        "end",
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                        {customRangeError && (
                            <p className="text-sm text-destructive">
                                {customRangeError}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowCustomRangeDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleCustomRangeApply}>
                            Apply range
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
