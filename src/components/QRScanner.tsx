import React, { useState } from "react";
import { View, Modal, Pressable, Dimensions } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { X, Camera as CameraIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Button } from "@/components/ui";

const { width } = Dimensions.get("window");
const FRAME = Math.min(width - 80, 280);

/** Full-screen QR scanner. Calls onScan once with the first code, then closes. */
export function QRScanner({ visible, onClose, onScan }: { visible: boolean; onClose: () => void; onScan: (data: string) => void }) {
  const { c } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  const handle = ({ data }: { data: string }) => {
    if (locked || !data) return;
    setLocked(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onScan(data);
    onClose();
    setTimeout(() => setLocked(false), 800);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {permission?.granted ? (
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={handle} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16, backgroundColor: c.bg }}>
            <View style={{ width: 72, height: 72, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>
              <CameraIcon size={30} color={c.accent} />
            </View>
            <Txt size={18} font="sansBold" align="center">Camera access needed</Txt>
            <Txt size={14} tone="muted" align="center" style={{ maxWidth: 280 }}>Allow camera access to scan ticket and VIP pass QR codes.</Txt>
            <Button label="Allow camera" onPress={requestPermission} />
          </View>
        )}

        {/* Overlay frame */}
        {permission?.granted ? (
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: FRAME, height: FRAME, borderRadius: 28, borderWidth: 3, borderColor: c.accent, backgroundColor: "transparent" }} />
            <Txt size={14} font="sansSemi" style={{ color: "#fff", marginTop: 20 }}>Point at the QR code</Txt>
          </View>
        ) : null}

        <Pressable onPress={onClose} style={{ position: "absolute", top: 54, right: 20, width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <X size={22} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}
