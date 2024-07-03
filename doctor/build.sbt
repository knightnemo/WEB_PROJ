ThisBuild / version := "0.1.0-SNAPSHOT"

ThisBuild / scalaVersion := "3.4.0"

lazy val root = (project in file("."))
  .settings(
    name := "Doctor"
  )

val http4sVersion = "1.0.0-M40"
val circeVersion = "0.14.6"

libraryDependencies ++= Seq(
  "org.http4s" %% "http4s-dsl" % http4sVersion,
  "org.http4s" %% "http4s-ember-server" % http4sVersion,
  "org.http4s" %% "http4s-ember-client" % http4sVersion,
  "org.http4s" %% "http4s-circe" % http4sVersion,
  "org.typelevel" %% "log4cats-slf4j" % "2.6.0",
  "io.circe" %% "circe-core" % circeVersion,
  "io.circe" %% "circe-generic" % circeVersion,
  "io.circe" %% "circe-parser" % circeVersion,
  "org.typelevel" %% "log4cats-core"    % "2.3.1",
  "org.typelevel" %% "log4cats-slf4j"   % "2.3.1",
  "org.apache.pdfbox" % "pdfbox" % "2.0.24",  // Replace "2.0.24" with the latest version available
  "ch.qos.logback" % "logback-classic" % "1.2.10", // SLF4J Backend Implementation
  "joda-time" % "joda-time" % "2.12.7" // Use the latest version available
)
scalacOptions ++= Seq("-feature", "-language:implicitConversions")
