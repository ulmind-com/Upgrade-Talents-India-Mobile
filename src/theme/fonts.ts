import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import {
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from "@expo-google-fonts/poppins";

/**
 * Clean District type system — only two geometric/humanist families load:
 * Inter for body & UI, Poppins for display. The loud fonts (Anton, Playfair,
 * Oswald, Archivo Black, JetBrains Mono) are no longer loaded; every font token
 * in tokens.ts is remapped onto this pair, so nothing in the app references a
 * missing family.
 */
export const fontMap = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
};
