import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getGetHomeworkViewQueryKey,
  useGetHomeworkView,
  useRegisterHomeworkPushToken,
  type HomeworkExercise,
  type HomeworkView,
} from "@workspace/api-client-react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHomeworkAuth } from "@/context/HomeworkAuthContext";
import { useColors } from "@/hooks/useColors";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function cachedViewKey(token: string) {
  return `homework-companion.view.${token}`;
}

function localReminderKey(token: string) {
  return `homework-companion.local-reminders.${token}`;
}

async function scheduleDeviceReminders(programs: HomeworkView["programs"], token: string) {
  const savedIds = await AsyncStorage.getItem(localReminderKey(token));
  const existingIds: string[] = savedIds ? JSON.parse(savedIds) as string[] : [];
  await Promise.all(existingIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  const ids: string[] = [];
  for (const program of programs) {
    if (!program.reminderEnabled || !program.reminderSchedule) continue;
    const hourlyMatch = /^hourly:([1-9]|1[0-9]|2[0-4])$/.exec(program.reminderSchedule);
    if (hourlyMatch) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Your homework is ready",
          body: `${program.title} is ready to review.`,
          sound: "default",
          data: { url: `homework-mobile://homework/${token}` },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Number(hourlyMatch[1]) * 60 * 60,
          repeats: true,
          ...(Platform.OS === "android" ? { channelId: "homework-reminders" } : {}),
        },
      });
      ids.push(id);
      continue;
    }
    const match = /^weekly:([0-6]):([01]\d|2[0-3]):([0-5]\d)$/.exec(program.reminderSchedule);
    if (!match) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your homework is ready",
        body: `${program.title} is ready to review.`,
        sound: "default",
        data: { url: `homework-mobile://homework/${token}` },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: Number(match[1]) + 1,
        hour: Number(match[2]),
        minute: Number(match[3]),
        ...(Platform.OS === "android" ? { channelId: "homework-reminders" } : {}),
      },
    });
    ids.push(id);
  }
  await AsyncStorage.setItem(localReminderKey(token), JSON.stringify(ids));
  return ids.length;
}

function extractToken(value: string) {
  const trimmed = value.trim();
  const linkToken = trimmed.match(/\/homework\/([^/?#\s]+)/)?.[1];
  return linkToken ?? trimmed.replace(/\s/g, "");
}

function formatFrequency(exercise: HomeworkExercise) {
  if (exercise.frequencyType === "daily") {
    return exercise.timesPerDay > 1 ? `${exercise.timesPerDay}× per day` : "Every day";
  }
  if (exercise.frequencyType === "specific_days" && exercise.daysOfWeek.length) {
    return exercise.daysOfWeek.map((day) => DAY_NAMES[day] ?? "").filter(Boolean).join(" · ");
  }
  return exercise.frequencyType === "times_per_week" ? "Weekly plan" : exercise.frequencyType;
}

function formatVolume(exercise: HomeworkExercise) {
  const parts: string[] = [];
  if (exercise.sets) parts.push(`${exercise.sets} sets`);
  if (exercise.reps) parts.push(`${exercise.reps} reps`);
  if (exercise.weight) parts.push(`${exercise.weight} ${exercise.unit}`);
  if (exercise.durationSeconds !== null && exercise.durationSeconds !== undefined) {
    const minutes = Math.floor(exercise.durationSeconds / 60);
    const seconds = exercise.durationSeconds % 60;
    parts.push(minutes > 0 ? (seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes} min`) : `${seconds}s`);
  }
  return parts.join(" · ");
}

function ExerciseCard({ exercise, index }: { exercise: HomeworkExercise; index: number }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const hasDetails = Boolean(exercise.instructions || exercise.videoUrl);
  const volume = formatVolume(exercise);

  return (
    <View style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole={hasDetails ? "button" : undefined}
        accessibilityLabel={`${exercise.name}${hasDetails ? ", show details" : ""}`}
        onPress={() => hasDetails && setExpanded((value) => !value)}
        style={({ pressed }) => [styles.exerciseTop, pressed && hasDetails ? styles.pressed : undefined]}
      >
        <View style={[styles.exerciseNumber, { backgroundColor: colors.accent }]}>
          <Text style={[styles.exerciseNumberText, { color: colors.accentForeground }]}>{index + 1}</Text>
        </View>
        <View style={styles.exerciseSummary}>
          <Text style={[styles.exerciseName, { color: colors.foreground }]}>{exercise.name}</Text>
          <View style={styles.tags}>
            <View style={[styles.tag, { backgroundColor: colors.secondary }]}>
              <Feather name="calendar" size={12} color={colors.secondaryForeground} />
              <Text style={[styles.tagText, { color: colors.secondaryForeground }]}>{formatFrequency(exercise)}</Text>
            </View>
            {volume ? (
              <View style={[styles.tag, { backgroundColor: colors.accent }]}>
                <MaterialCommunityIcons name="arm-flex-outline" size={14} color={colors.accentForeground} />
                <Text style={[styles.tagText, { color: colors.accentForeground }]}>{volume}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {hasDetails ? (
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.mutedForeground} />
        ) : null}
      </Pressable>
      {expanded ? (
        <View style={[styles.exerciseDetails, { borderTopColor: colors.border }]}>
          {exercise.instructions ? (
            <Text style={[styles.instructions, { color: colors.mutedForeground }]}>{exercise.instructions}</Text>
          ) : null}
          {exercise.videoUrl ? (
            <Pressable
              accessibilityRole="link"
              testID={`watch-video-${exercise.id}`}
              onPress={() => void Linking.openURL(exercise.videoUrl!)}
              style={({ pressed }) => [styles.videoButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
            >
              <Feather name="play" size={15} color={colors.primaryForeground} />
              <Text style={[styles.videoButtonText, { color: colors.primaryForeground }]}>Watch video</Text>
              <Feather name="external-link" size={14} color={colors.primaryForeground} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function MagicLinkEntry() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { saveToken } = useHomeworkAuth();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function continueWithToken() {
    const token = extractToken(value);
    if (!token) {
      setError("Paste the link from your practitioner’s email.");
      return;
    }
    void Haptics.selectionAsync();
    setError(null);
    saveToken(token);
  }

  return (
    <View style={[styles.entryContainer, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 32) }]}>
      <View style={[styles.entryMark, { backgroundColor: colors.primary }]}>
        <MaterialCommunityIcons name="heart-pulse" size={34} color={colors.primaryForeground} />
      </View>
      <Text style={[styles.entryEyebrow, { color: colors.primary }]}>HOMEWORK COMPANION</Text>
      <Text style={[styles.entryTitle, { color: colors.foreground }]}>Your plan, always close by.</Text>
      <Text style={[styles.entryCopy, { color: colors.mutedForeground }]}>
        Open the link your practitioner sent you. Your program will stay available here when you need it.
      </Text>
      <View style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.inputLabel, { color: colors.foreground }]}>Homework link</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          value={value}
          onChangeText={setValue}
          onSubmitEditing={continueWithToken}
          placeholder="Paste your link or token"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground, borderColor: error ? colors.destructive : colors.input }]}
          testID="magic-link-input"
        />
        {error ? <Text style={[styles.validationText, { color: colors.destructive }]}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          testID="open-homework"
          onPress={continueWithToken}
          style={({ pressed }) => [styles.openButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
        >
          <Text style={[styles.openButtonText, { color: colors.primaryForeground }]}>Open my homework</Text>
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>
      <Text style={[styles.entryFootnote, { color: colors.mutedForeground, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
        Your link is personal—keep it private.
      </Text>
    </View>
  );
}

function HomeworkHome({ token }: { token: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { clearToken } = useHomeworkAuth();
  const [cachedData, setCachedData] = useState<HomeworkView | undefined>(undefined);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [notificationsState, setNotificationsState] = useState<"idle" | "enabled" | "unavailable" | "error" | "noSchedule">("idle");
  const pushRegistration = useRegisterHomeworkPushToken();

  useEffect(() => {
    let active = true;
    setCacheLoaded(false);
    setCachedData(undefined);
    void AsyncStorage.getItem(cachedViewKey(token))
      .then((value) => {
        if (!active || !value) return;
        setCachedData(JSON.parse(value) as HomeworkView);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCacheLoaded(true);
      });
    return () => { active = false; };
  }, [token]);

  const viewQuery = useGetHomeworkView(token, {
    query: {
      queryKey: getGetHomeworkViewQueryKey(token),
      enabled: cacheLoaded,
      initialData: cachedData,
      networkMode: "offlineFirst",
      retry: 1,
      staleTime: 60_000,
    },
  });
  const data = viewQuery.data ?? cachedData;

  useEffect(() => {
    if (viewQuery.data) {
      void AsyncStorage.setItem(cachedViewKey(token), JSON.stringify(viewQuery.data));
    }
  }, [token, viewQuery.data]);

  const programCount = data?.programs.length ?? 0;
  const exerciseCount = useMemo(
    () => data?.programs.reduce((sum, program) => sum + program.exercises.length, 0) ?? 0,
    [data],
  );

  async function enableNotifications() {
    if (Platform.OS === "web") {
      setNotificationsState("unavailable");
      return;
    }
    if (!data) return;
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("homework-reminders", {
          name: "Homework reminders",
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 200, 250],
        });
      }
      const existing = await Notifications.getPermissionsAsync();
      const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setNotificationsState("unavailable");
        return;
      }
      const projectId = Constants.easConfig?.projectId
        ?? Constants.expoConfig?.extra?.["eas"]?.["projectId"];
      const localReminderCount = await scheduleDeviceReminders(data.programs, token);
      if (projectId) {
        try {
          const deviceToken = await Notifications.getExpoPushTokenAsync({ projectId });
          await pushRegistration.mutateAsync({
            token,
            data: {
              token: deviceToken.data,
              platform: Platform.OS === "ios" ? "ios" : "android",
            },
          });
        } catch {
          if (localReminderCount === 0) throw new Error("Push token registration failed");
        }
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotificationsState(localReminderCount > 0 || Boolean(projectId) ? "enabled" : "noSchedule");
    } catch {
      setNotificationsState("error");
    }
  }

  if (!cacheLoaded || (viewQuery.isLoading && !data)) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading your plan…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background, paddingHorizontal: 28 }]}>
        <View style={[styles.errorIcon, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons name="link-variant-off" size={28} color={colors.accentForeground} />
        </View>
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>We couldn’t open that plan</Text>
        <Text style={[styles.errorCopy, { color: colors.mutedForeground }]}>Check that you used the current link from your practitioner.</Text>
        <Pressable onPress={clearToken} style={({ pressed }) => [styles.retryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
          <Text style={[styles.retryButtonText, { color: colors.foreground }]}>Use another link</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 18), paddingBottom: insets.bottom + (Platform.OS === "web" ? 44 : 24) }]}
        refreshControl={<RefreshControl refreshing={viewQuery.isRefetching} onRefresh={() => void viewQuery.refetch()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR HOMEWORK</Text>
            <Text style={[styles.greeting, { color: colors.foreground }]}>Hi, {data.clientName.split(" ")[0]}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change homework link"
            onPress={() => Alert.alert("Change homework link?", "This removes this program from this device.", [
              { text: "Cancel", style: "cancel" },
              { text: "Change link", style: "destructive", onPress: clearToken },
            ])}
            style={({ pressed }) => [styles.profileButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
          >
            <Feather name="more-horizontal" size={22} color={colors.secondaryForeground} />
          </Pressable>
        </View>

        <View style={[styles.summary, { backgroundColor: colors.primary }]}>
          <View>
            <Text style={[styles.summaryLabel, { color: colors.primaryForeground }]}>YOUR ACTIVE PLAN</Text>
            <Text style={[styles.summaryTitle, { color: colors.primaryForeground }]}>{programCount === 1 ? data.programs[0]?.title : `${programCount} active programs`}</Text>
            <Text style={[styles.summaryCopy, { color: colors.primaryForeground }]}>{exerciseCount} exercises ready whenever you are.</Text>
          </View>
          <View style={[styles.summaryIcon, { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons name="heart-pulse" size={32} color={colors.accentForeground} />
          </View>
        </View>

        <View style={[styles.notificationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.bellCircle, { backgroundColor: colors.accent }]}>
            <Feather name="bell" size={19} color={colors.accentForeground} />
          </View>
          <View style={styles.notificationCopy}>
            <Text style={[styles.notificationTitle, { color: colors.foreground }]}>
              {notificationsState === "enabled" ? "Reminders are on" : "Want a gentle nudge?"}
            </Text>
            <Text style={[styles.notificationBody, { color: colors.mutedForeground }]}>
              {notificationsState === "enabled"
                ? "Your weekly device reminders are ready. Published app builds also receive practitioner-sent push reminders."
                : notificationsState === "noSchedule"
                  ? "Your practitioner hasn’t set a weekly reminder for this program yet."
                : notificationsState === "unavailable"
                  ? "Enable notifications in your device settings whenever you’re ready."
                  : notificationsState === "error"
                    ? "We couldn’t enable reminders. Please try again."
                    : "Get a notification when it’s time to check your homework."}
            </Text>
          </View>
          {notificationsState !== "enabled" ? (
            <Pressable
              accessibilityRole="button"
              testID="enable-notifications"
              disabled={pushRegistration.isPending}
              onPress={() => void enableNotifications()}
              style={({ pressed }) => [styles.bellButton, { backgroundColor: colors.secondary }, pressed && styles.pressed, pushRegistration.isPending && styles.disabled]}
            >
              {pushRegistration.isPending ? <ActivityIndicator size="small" color={colors.secondaryForeground} /> : <Feather name="bell" size={17} color={colors.secondaryForeground} />}
            </Pressable>
          ) : <Feather name="check-circle" size={21} color={colors.primary} />}
        </View>

        {viewQuery.isError && cachedData ? (
          <View style={[styles.offlineBanner, { backgroundColor: colors.secondary }]}>
            <Feather name="wifi-off" size={14} color={colors.secondaryForeground} />
            <Text style={[styles.offlineText, { color: colors.secondaryForeground }]}>Showing your saved plan while you’re offline.</Text>
          </View>
        ) : null}

        {data.programs.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No active programs yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Your practitioner will add your exercises here when they’re ready.</Text>
          </View>
        ) : data.programs.map((program) => (
          <View key={program.id} style={styles.programSection}>
            <View style={styles.sectionHeading}>
              <Text style={[styles.programTitle, { color: colors.foreground }]}>{program.title}</Text>
              {program.notes ? <Text style={[styles.programNotes, { color: colors.mutedForeground }]}>{program.notes}</Text> : null}
            </View>
            {program.exercises.length === 0 ? (
              <Text style={[styles.noExercises, { color: colors.mutedForeground }]}>Your exercises will appear here soon.</Text>
            ) : program.exercises.map((exercise, index) => (
              <ExerciseCard key={exercise.id} exercise={exercise} index={index} />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeworkIndex() {
  const { token, isReady } = useHomeworkAuth();
  if (!isReady) return null;
  return token ? <HomeworkHome token={token} /> : <MagicLinkEntry />;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 18 },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  loadingText: { fontFamily: "Inter_500Medium", fontSize: 15 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.2 },
  greeting: { fontFamily: "Inter_700Bold", fontSize: 30, marginTop: 2 },
  profileButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  summary: { borderRadius: 18, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 138 },
  summaryLabel: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.1, opacity: 0.78 },
  summaryTitle: { fontFamily: "Inter_700Bold", fontSize: 21, marginTop: 6, maxWidth: "78%" },
  summaryCopy: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 7, opacity: 0.84 },
  summaryIcon: { height: 58, width: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  notificationCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  bellCircle: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  notificationCopy: { flex: 1 },
  notificationTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  notificationBody: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, marginTop: 2 },
  bellButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  offlineBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  offlineText: { fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 },
  programSection: { gap: 10 },
  sectionHeading: { gap: 4, paddingTop: 4 },
  programTitle: { fontFamily: "Inter_700Bold", fontSize: 21 },
  programNotes: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  exerciseCard: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  exerciseTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 15 },
  exerciseNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 1 },
  exerciseNumberText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  exerciseSummary: { flex: 1, gap: 8 },
  exerciseName: { fontFamily: "Inter_600SemiBold", fontSize: 16, lineHeight: 21 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 },
  tagText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  exerciseDetails: { borderTopWidth: 1, marginTop: 0, padding: 15, gap: 13 },
  instructions: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  videoButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 10 },
  videoButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  noExercises: { fontFamily: "Inter_400Regular", fontSize: 14, fontStyle: "italic", paddingVertical: 12 },
  emptyState: { alignItems: "center", gap: 9, paddingHorizontal: 34, paddingTop: 78 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, marginTop: 4 },
  emptyCopy: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, textAlign: "center" },
  errorIcon: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center" },
  errorTitle: { fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center", marginTop: 5 },
  errorCopy: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, textAlign: "center" },
  retryButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, marginTop: 7 },
  retryButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  entryContainer: { flex: 1, paddingHorizontal: 24, alignItems: "center" },
  entryMark: { width: 68, height: 68, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 34, marginBottom: 26 },
  entryEyebrow: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.45 },
  entryTitle: { fontFamily: "Inter_700Bold", fontSize: 31, lineHeight: 38, textAlign: "center", marginTop: 10 },
  entryCopy: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 13, maxWidth: 330 },
  entryCard: { width: "100%", borderWidth: 1, borderRadius: 16, padding: 16, gap: 9, marginTop: 31 },
  inputLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  input: { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontFamily: "Inter_400Regular", fontSize: 14 },
  validationText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  openButton: { height: 50, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  openButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  entryFootnote: { marginTop: "auto", fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" },
});