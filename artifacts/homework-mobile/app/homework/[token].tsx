import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useHomeworkAuth } from "@/context/HomeworkAuthContext";

export default function HomeworkDeepLinkScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ token: string }>();
  const { saveToken } = useHomeworkAuth();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  useEffect(() => {
    if (!token) return;
    saveToken(token);
    router.replace("/");
  }, [saveToken, token]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});