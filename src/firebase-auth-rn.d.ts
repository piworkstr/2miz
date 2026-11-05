// Firebase, React Native'e özel bu fonksiyonu yalnızca RN derlemesinde dışa aktarır.
// Metro çalışırken doğru dosyayı seçer; bu bildirim sadece TypeScript'in görmesi için.
import 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}
