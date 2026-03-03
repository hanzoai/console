import { InsightsLogo } from "@/src/components/InsightsLogo";
import Header from "@/src/components/layouts/header";
import ContainerPage from "@/src/components/layouts/container-page";
import { StatusBadge } from "@/src/components/layouts/status-badge";
import { Button } from "@/src/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { PasswordInput } from "@/src/components/ui/password-input";
import { Switch } from "@/src/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/src/components/ui/tooltip";
import { useInsightsCapture } from "@/src/features/insights-analytics/useInsightsCapture";
import { insightsIntegrationFormSchema } from "@/src/features/insights-integration/types";
import { AnalyticsIntegrationExportSource, EXPORT_SOURCE_OPTIONS } from "@hanzo/shared";
import { useV4Beta } from "@/src/features/events/hooks/useV4Beta";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { api } from "@/src/utils/api";
import { type RouterOutput } from "@/src/utils/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/src/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { type z } from "zod/v4";
import { Info, ExternalLink } from "lucide-react";

export default function InsightsIntegrationSettings() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  const hasAccess = useHasProjectAccess({
    projectId,
    scope: "integrations:CRUD",
  });
  const state = api.insightsIntegration.get.useQuery(
    { projectId },
    {
      enabled: hasAccess,
    },
  );

  const status = state.isInitialLoading || !hasAccess ? undefined : state.data?.enabled ? "active" : "inactive";

  return (
    <ContainerPage
      headerProps={{
        title: "Hanzo Insights Integration",
        breadcrumb: [{ name: "Settings", href: `/project/${projectId}/settings` }],
        actionButtonsLeft: <>{status && <StatusBadge type={status} />}</>,
        actionButtonsRight: (
          <Button asChild variant="secondary">
            <Link href="https://hanzo.com/integrations/analytics/insights">Integration Docs ↗</Link>
          </Button>
        ),
      }}
    >
      <p className="mb-4 text-sm text-primary">
        We have teamed up with{" "}
        <Link href="https://insights.com" className="underline">
          Hanzo Insights
        </Link>{" "}
        (OSS product analytics) to make Hanzo Cloud events/metrics available in your Hanzo Insights dashboards. Upon
        activation, all historical data from your project will be synced. After the initial sync, new data is
        automatically synced every hour to keep your Hanzo Insights dashboards up to date.
      </p>
      {!hasAccess && (
        <p className="text-sm">
          You current role does not grant you access to these settings, please reach out to your project admin or owner.
        </p>
      )}
      {hasAccess && (
        <>
          <Header title="Configuration" />
          <Card className="p-3">
            <InsightsLogo className="mb-4 w-36 text-foreground" />
            <InsightsIntegrationForm state={state.data} projectId={projectId} isLoading={state.isLoading} />
          </Card>
        </>
      )}
      {state.data?.enabled && (
        <>
          <Header title="Status" className="mt-8" />
          <p className="text-sm text-primary">
            Data synced until:{" "}
            {state.data?.lastSyncAt ? new Date(state.data.lastSyncAt).toLocaleString() : "Never (pending)"}
          </p>
        </>
      )}
    </ContainerPage>
  );
}

const InsightsIntegrationForm = ({
  state,
  projectId,
  isLoading,
}: {
  state?: RouterOutput["insightsIntegration"]["get"];
  projectId: string;
  isLoading: boolean;
}) => {
  const capture = useInsightsCapture();
  const { isBetaEnabled } = useV4Beta();
  const insightsForm = useForm({
    resolver: zodResolver(insightsIntegrationFormSchema),
    defaultValues: {
      insightsHostname: state?.insightsHostName ?? "",
      insightsProjectApiKey: state?.insightsApiKey ?? "",
      enabled: state?.enabled ?? false,
      exportSource:
        state?.exportSource ??
        (isBetaEnabled
          ? AnalyticsIntegrationExportSource.EVENTS
          : AnalyticsIntegrationExportSource.TRACES_OBSERVATIONS),
    },
    disabled: isLoading,
  });

  useEffect(() => {
    insightsForm.reset({
      insightsHostname: state?.insightsHostName ?? "",
      insightsProjectApiKey: state?.insightsApiKey ?? "",
      enabled: state?.enabled ?? false,
      exportSource:
        state?.exportSource ??
        (isBetaEnabled
          ? AnalyticsIntegrationExportSource.EVENTS
          : AnalyticsIntegrationExportSource.TRACES_OBSERVATIONS),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const utils = api.useUtils();
  const mut = api.insightsIntegration.update.useMutation({
    onSuccess: () => {
      utils.insightsIntegration.invalidate();
    },
  });
  const mutDelete = api.insightsIntegration.delete.useMutation({
    onSuccess: () => {
      utils.insightsIntegration.invalidate();
    },
  });

  async function onSubmit(values: z.infer<typeof insightsIntegrationFormSchema>) {
    capture("integrations:insights_form_submitted");
    mut.mutate({
      projectId,
      ...values,
    });
  }

  return (
    <Form {...insightsForm}>
      <form className="space-y-3" onSubmit={insightsForm.handleSubmit(onSubmit)}>
        <FormField
          control={insightsForm.control}
          name="insightsHostname"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hanzo Insights Hostname</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>US region: https://us.insights.com; EU region: https://eu.insights.com</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={insightsForm.control}
          name="insightsProjectApiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hanzo Insights Project API Key</FormLabel>
              <FormControl>
                <PasswordInput {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {isBetaEnabled && (
          <FormField
            control={insightsForm.control}
            name="exportSource"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5 pt-2">
                  Export Source
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[350px] space-y-2 p-3">
                      {EXPORT_SOURCE_OPTIONS.map((option) => (
                        <div key={option.value} className="space-y-0.5">
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </div>
                      ))}
                      <div className="border-t pt-2">
                        <a
                          href="https://hanzo.ai/docs/integrations/export-sources"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                        >
                          For further information see
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select data to export" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EXPORT_SOURCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose which data sources to export to Hanzo Insights. Scores are always included.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={insightsForm.control}
          name="enabled"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Enabled</FormLabel>
              <FormControl>
                <Switch
                  id="insights-integration-enabled"
                  checked={field.value}
                  onCheckedChange={() => {
                    field.onChange(!field.value);
                  }}
                  className="ml-4 mt-1"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
      <div className="mt-8 flex gap-2">
        <Button loading={mut.isPending} onClick={insightsForm.handleSubmit(onSubmit)} disabled={isLoading}>
          Save
        </Button>
        <Button
          variant="ghost"
          loading={mutDelete.isPending}
          disabled={isLoading || !!!state}
          onClick={() => {
            if (confirm("Are you sure you want to reset the Hanzo Insights integration for this project?"))
              mutDelete.mutate({ projectId });
          }}
        >
          Reset
        </Button>
      </div>
    </Form>
  );
};
