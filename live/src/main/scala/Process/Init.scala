package Process

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
  def init(config: ServerConfig): IO[Unit] =
    given PlanContext = PlanContext(traceID = TraceID(UUID.randomUUID().toString), 0)
    for {
      _ <- API.init(config.maximumClientConnection)
      _ <- initSchema(schemaName)
      _ <- writeDB(
        s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.live_streams (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          classroom VARCHAR(255) NOT NULL,
          teacher VARCHAR(255) NOT NULL,
          slot INT NOT NULL,
          UNIQUE (classroom, slot)
        )
        """,
        List()
      )
    } yield ()
}