package Process

import APIs.DoctorAPI.DoctorInfo
import Common.API.{API, PlanContext, TraceID}
import Global.{ServerConfig, ServiceCenter}
import Common.DBAPI.{WriteDBMessage, initSchema, writeDB}
import Common.Object.SqlParameter
import Common.API.PlanContext
import Common.ServiceUtils.schemaName
import cats.effect.IO
import io.circe.generic.auto.*
import org.http4s.client.Client

import java.util.UUID

object Init {
  def init(config:ServerConfig):IO[Unit]=
    given PlanContext=PlanContext(traceID = TraceID(UUID.randomUUID().toString),0)
    for{
      _ <- API.init(config.maximumClientConnection)
      _ <- initSchema(schemaName)
      _ <- writeDB(s"CREATE TABLE IF NOT EXISTS ${schemaName}.user_name (user_name TEXT, password TEXT)", List())
      _ <- writeDB(s"CREATE TABLE IF NOT EXISTS ${schemaName}.doctor_rec (doctor_name TEXT, patient_name TEXT)", List())
      _ <- writeDB(
        s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.doctors (
          user_name VARCHAR(255) PRIMARY KEY,
          bio TEXT,
          followers INT DEFAULT 0,
          following INT DEFAULT 0,
          review_count INT DEFAULT 0
        )
        """,
        List()
      )
      /* 这是因为后端还没开发好，仅供开发使用
      _ <- writeDB(
        s"""
        INSERT INTO ${schemaName}.doctors (user_name, bio, followers, following, review_count)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (user_name) DO UPDATE SET
        bio = EXCLUDED.bio,
        followers = EXCLUDED.followers,
        following = EXCLUDED.following,
        review_count = EXCLUDED.review_count
        """,
        List(
          SqlParameter("String", "Alice"),
          SqlParameter("String", "Got an A+ in Math4CS&AI"),
          SqlParameter("Int", "1000"),
          SqlParameter("Int", "500"),
          SqlParameter("Int", "200")
        )
      ) */
    } yield ()

}
