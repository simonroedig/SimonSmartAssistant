import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The dashboard this launcher shows (the Vercel deployment).
val dashboardUrl = providers.gradleProperty("dashboardUrl").getOrElse("https://simonsmartassistant.vercel.app")
// Set by CI: the signing key is decrypted into a temporary file for the build.
val keystorePath: String? = System.getenv("SIGNING_KEYSTORE")
val keystorePassword: String? = System.getenv("SIGNING_PASSWORD")

android {
    namespace = "de.simonroedig.smartassistant"
    compileSdk = 36

    defaultConfig {
        applicationId = "de.simonroedig.smartassistant"
        minSdk = 29
        targetSdk = 36
        versionCode = providers.gradleProperty("versionCode").getOrElse("1").toInt()
        versionName = providers.gradleProperty("versionName").getOrElse("dev")
        buildConfigField("String", "DASHBOARD_URL", "\"$dashboardUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (keystorePath != null && keystorePassword != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = keystorePassword
                keyAlias = "launcher"
                keyPassword = keystorePassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
    }

    lint {
        // A personal app: lint runs separately, it never blocks a release.
        checkReleaseBuilds = false
        abortOnError = false
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.webkit:webkit:1.13.0")
}
