import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

// Release signing: environment variables (CI) or keystore.properties (local, not committed).
// If neither is present, the release APK is built unsigned.
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun signingValue(env: String, prop: String): String? =
    System.getenv(env)?.takeIf { it.isNotBlank() } ?: keystoreProps.getProperty(prop)

val releaseStoreFile = signingValue("CHEKI_KEYSTORE_FILE", "storeFile")
val hasReleaseSigning = releaseStoreFile != null && rootProject.file(releaseStoreFile).exists()

android {
    namespace = "cheki.totonoe"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "cheki.totonoe"
        minSdk = 24
        targetSdk = 37
        versionCode = System.getenv("CHEKI_VERSION_CODE")?.toIntOrNull() ?: 1
        versionName = System.getenv("CHEKI_VERSION_NAME") ?: "0.1.0"
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = rootProject.file(releaseStoreFile!!)
                storePassword = signingValue("CHEKI_KEYSTORE_PASSWORD", "storePassword")
                keyAlias = signingValue("CHEKI_KEY_ALIAS", "keyAlias")
                keyPassword = signingValue("CHEKI_KEY_PASSWORD", "keyPassword")
            }
        }
    }

    buildTypes {
        release {
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(libs.androidbrowserhelper)
}
