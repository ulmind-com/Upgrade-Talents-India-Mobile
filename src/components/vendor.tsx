import React from "react";
import type { ViewProps } from "react-native";
import RNWebView, { type WebViewProps } from "react-native-webview";
import RNMaskedView from "@react-native-masked-view/masked-view";

/**
 * Vendor components whose published typings lag React 19.
 *
 * Both packages are already at their latest version, so there is no upgrade
 * that fixes these — and both work perfectly at runtime. The casts are
 * confined to this file so the rest of the app stays honestly typed.
 */

/*
 * react-native-webview's root `index.d.ts` declares
 *   class WebView<P = undefined> extends Component<WebViewProps & P>
 * and `WebViewProps & undefined` collapses to `never`, so under React 19's JSX
 * resolution every prop is rejected ("props: never"). The package's own
 * lib/WebView.d.ts already has the right shape, but that is an internal path,
 * so the public surface is restated here instead.
 */
export type WebViewInstance = {
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  stopLoading: () => void;
  injectJavaScript: (script: string) => void;
  postMessage: (message: string) => void;
  requestFocus: () => void;
  clearCache: (includeDiskFiles: boolean) => void;
};

export const WebView = RNWebView as unknown as React.ForwardRefExoticComponent<
  WebViewProps & React.RefAttributes<WebViewInstance>
>;

/*
 * @react-native-masked-view builds its export as
 *   Constructor<NativeMethods> & typeof MaskedViewComponent
 * and that intersection's instance type no longer carries `props` under the
 * React 19 types, which is why TS reports "cannot be used as a JSX component".
 */
export type MaskedViewProps = ViewProps & {
  maskElement: React.ReactElement;
  androidRenderingMode?: "software" | "hardware";
};

export const MaskedView = RNMaskedView as unknown as React.ComponentType<MaskedViewProps>;
