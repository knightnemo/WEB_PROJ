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
      // ... 其他表的创建 ...
      _ <- writeDB(
        s"""
          CREATE TABLE IF NOT EXISTS ${schemaName}.classrooms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            capacity INT NOT NULL,
            slot1 TEXT DEFAULT '0',
            slot2 TEXT DEFAULT '0',
            slot3 TEXT DEFAULT '0',
            slot4 TEXT DEFAULT '0',
            slot5 TEXT DEFAULT '0',
            slot6 TEXT DEFAULT '0',
            slot7 TEXT DEFAULT '0',
            slot8 TEXT DEFAULT '0'
          )
          """,
        List()
      )
      _ <- writeDB(
        s"""
          INSERT INTO ${schemaName}.classrooms (id, name, capacity)
          VALUES ('classroom1', '三教', 30), ('classroom2', '四教', 40)
          ON CONFLICT (id) DO NOTHING
          """,
        List()
      )
    } yield ()
}