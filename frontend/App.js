import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { Poppins_800ExtraBold } from '@expo-google-fonts/poppins/800ExtraBold';
import { useFonts } from 'expo-font';
import { ActivityIndicator, Animated, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeInUp, SparkleField, usePop } from './src/components/Animations';
import Logo from './src/components/Logo';
import PhoneFrame from './src/components/PhoneFrame';
import { AppProvider, useApp } from './src/context/AppContext';
import { readWebPaymentReturn } from './src/payment';
import AccountScreen from './src/screens/AccountScreen';
import AddressesScreen from './src/screens/AddressesScreen';
import CartScreen from './src/screens/CartScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import OtpScreen from './src/screens/OtpScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import ProductListScreen from './src/screens/ProductListScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WishlistScreen from './src/screens/WishlistScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import SignupScreen from './src/screens/SignupScreen';
import SellerAccountScreen from './src/screens/seller/SellerAccountScreen';
import SellerDashboardScreen from './src/screens/seller/SellerDashboardScreen';
import SellerOrdersScreen from './src/screens/seller/SellerOrdersScreen';
import SellerProductFormScreen from './src/screens/seller/SellerProductFormScreen';
import SellerProductsScreen from './src/screens/seller/SellerProductsScreen';
import SellerQuotesScreen from './src/screens/seller/SellerQuotesScreen';
import QuotesScreen from './src/screens/b2b/QuotesScreen';
import RequestQuoteScreen from './src/screens/b2b/RequestQuoteScreen';
import MyResaleScreen from './src/screens/resale/MyResaleScreen';
import ResellScreen from './src/screens/resale/ResellScreen';
import { colors, fonts } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Read once at startup: did Cashfree just redirect the web app back here?
let webPaymentReturn = readWebPaymentReturn();

const TAB_ICONS = {
  Home: 'home',
  Categories: 'grid',
  Wishlist: 'heart',
  Cart: 'cart',
  Account: 'person',
  SellerHome: 'speedometer',
  SellerProducts: 'pricetags',
  SellerOrders: 'receipt',
  SellerQuotes: 'chatbox-ellipses',
  SellerAccount: 'storefront',
};

/** Tab icon that bounces when it becomes active, with a gold dot underneath. */
function TabIcon({ name, focused, color }) {
  const pop = usePop(focused);
  return (
    <Animated.View style={[{ alignItems: 'center' }, focused && pop]}>
      <Ionicons name={focused ? name : `${name}-outline`} size={22} color={color} />
      {focused && (
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent, position: 'absolute', bottom: -6 }} />
      )}
    </Animated.View>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { cart } = useApp();
  const navigation = useNavigation();

  useEffect(() => {
    if (!webPaymentReturn) return;
    const { orderId } = webPaymentReturn;
    webPaymentReturn = null; // only once
    // wait until the navigator has finished mounting, otherwise the navigation is ignored
    setTimeout(() => navigation.navigate('Orders', { verifyId: orderId }), 300);
  }, [navigation]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10.5, fontFamily: fonts.medium, lineHeight: 14, letterSpacing: 0.2 },
        // explicit height + safe-area padding so icons and labels are never cut off at the bottom
        tabBarStyle: {
          height: 66 + insets.bottom,
          paddingBottom: 6 + insets.bottom,
          paddingTop: 7,
          backgroundColor: '#fff',
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
        tabBarIcon: ({ focused, color }) => <TabIcon name={TAB_ICONS[route.name]} focused={focused} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Wishlist" component={WishlistScreen} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarBadge: cart.count > 0 ? cart.count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: '#3a2500', fontSize: 10, fontWeight: '800' },
        }}
      />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

/** Shared bottom-tab look for buyers and sellers. */
function useTabOptions() {
  const insets = useSafeAreaInsets();
  return ({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    tabBarLabelStyle: { fontSize: 10.5, fontFamily: fonts.medium, lineHeight: 14, letterSpacing: 0.2 },
    tabBarStyle: {
      height: 66 + insets.bottom,
      paddingBottom: 6 + insets.bottom,
      paddingTop: 7,
      backgroundColor: '#fff',
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      elevation: 0,
    },
    tabBarIcon: ({ focused, color }) => <TabIcon name={TAB_ICONS[route.name]} focused={focused} color={color} />,
  });
}

function SellerTabs() {
  const { user } = useApp();
  const screenOptions = useTabOptions();
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="SellerHome" component={SellerDashboardScreen} options={{ title: 'Dashboard' }} />
      {user?.is_approved && (
        <>
          <Tab.Screen name="SellerProducts" component={SellerProductsScreen} options={{ title: 'Products' }} />
          <Tab.Screen name="SellerOrders" component={SellerOrdersScreen} options={{ title: 'Orders' }} />
          <Tab.Screen name="SellerQuotes" component={SellerQuotesScreen} options={{ title: 'Quotes' }} />
        </>
      )}
      <Tab.Screen name="SellerAccount" component={SellerAccountScreen} options={{ title: 'My Shop' }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { booting, token, isSeller } = useApp();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, gap: 28 }}>
        <SparkleField count={16} seed={3} />
        <FadeInUp>
          <Logo size={28} align="center" />
        </FadeInUp>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'slide_from_right' }}>
      {token && isSeller ? (
        <>
          <Stack.Screen name="SellerMain" component={SellerTabs} />
          <Stack.Screen name="SellerProductForm" component={SellerProductFormScreen} />
        </>
      ) : token ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="ProductList" component={ProductListScreen} />
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} />
          <Stack.Screen name="Orders" component={OrdersScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Addresses" component={AddressesScreen} />
          <Stack.Screen name="RequestQuote" component={RequestQuoteScreen} />
          <Stack.Screen name="Quotes" component={QuotesScreen} />
          <Stack.Screen name="Resell" component={ResellScreen} />
          <Stack.Screen name="MyResale" component={MyResaleScreen} />
          <Stack.Screen name="ResaleOrders" component={SellerOrdersScreen} initialParams={{ title: 'Resale orders', back: true }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="Otp" component={OtpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.primary }} />;
  }

  return (
    <PhoneFrame>
      <SafeAreaProvider>
        <AppProvider>
          <NavigationContainer
            documentTitle={{ formatter: () => 'Vetri Shopping Hall' }}
            theme={{
              dark: false,
              colors: {
                primary: colors.primary,
                background: colors.bg,
                card: '#fff',
                text: colors.text,
                border: colors.border,
                notification: colors.accent,
              },
              fonts: {
                regular: { fontFamily: fonts.regular, fontWeight: 'normal' },
                medium: { fontFamily: fonts.medium, fontWeight: 'normal' },
                bold: { fontFamily: fonts.semibold, fontWeight: 'normal' },
                heavy: { fontFamily: fonts.bold, fontWeight: 'normal' },
              },
            }}
          >
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="light" />
        </AppProvider>
      </SafeAreaProvider>
    </PhoneFrame>
  );
}
