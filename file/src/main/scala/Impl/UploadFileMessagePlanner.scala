package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.{WriteDBListMessage, startTransaction, writeDBList}
import Common.Object.{ParameterList, SqlParameter}
import Common.ServiceUtils.schemaName
import cats.effect.IO
import java.util.Base64
import io.circe.{Encoder, Json}

case class UploadFileMessagePlanner(fileName: String, fileContent: Array[Byte], override val planContext: PlanContext) extends Planner[String]:
  implicit val encodeWriteDBListMessage: Encoder[WriteDBListMessage] = new Encoder[WriteDBListMessage] {
    final def apply(a: WriteDBListMessage): Json = Json.obj(
      ("sqlStatement", Json.fromString(a.sqlStatement)),
      ("parameters", Json.arr(a.parameters.map { paramList =>
        Json.arr(paramList.l.map { param =>
          Json.obj(
            ("dataType", Json.fromString(param.dataType)),
            ("value", Json.fromString(param.value))
          )
        }: _*)
      }: _*))
    )
  }

  override def plan(using PlanContext): IO[String] = {
    val base64Content = Base64.getEncoder.encodeToString(fileContent)
    val sql = s"INSERT INTO ${schemaName}.files (file_name, file_content) VALUES (?, ?)"
    val params = List(ParameterList(List(
      SqlParameter("String", fileName),
      SqlParameter("String", base64Content)
    )))

    startTransaction {
      for {
        _ <- writeDBList(sql, params)
      } yield "File uploaded successfully"
    }
  }