ThisBuild / version := "0.1.0-SNAPSHOT"

ThisBuild / scalaVersion := "3.4.0"

lazy val root = (project in file("."))
  .settings(
    name := "Portal"
  )
val http4sVersion = "1.0.0-M40"
val circeVersion = "0.14.6"

libraryDependencies ++= Seq(
  "org.typelevel" %% "cats-effect" % "3.5.3",

  "com.zaxxer" % "HikariCP" % "5.1.0", // Replace x.y.z with the actual version
  "org.postgresql" % "postgresql" % "42.7.2",

  "org.http4s" %% "http4s-dsl" % http4sVersion,
  "org.http4s" %% "http4s-ember-server" % http4sVersion,
  "org.http4s" %% "http4s-ember-client" % http4sVersion,
  "org.http4s" %% "http4s-circe" % http4sVersion,
  "org.typelevel" %% "log4cats-slf4j" % "2.6.0",
  "io.circe" %% "circe-core" % circeVersion,
  "io.circe" %% "circe-generic" % circeVersion,
  "io.circe" %% "circe-parser" % circeVersion,
  "joda-time" % "joda-time" % "2.12.7" // Use the latest version available
)