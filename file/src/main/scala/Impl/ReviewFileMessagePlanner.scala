package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.{WriteDBListMessage, startTransaction, writeDBList}
import Common.Object.{ParameterList, SqlParameter}
import Common.ServiceUtils.schemaName
import cats.effect.IO
import io.circe.{Encoder, Json}

case class ReviewFileMessagePlanner(fileId: Int, reviewStatus: String, override val planContext: PlanContext) extends Planner[String]:
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
    val sql = s"UPDATE ${schemaName}.files SET review_status = ? WHERE file_id = ?"
    val params = List(ParameterList(List(
      SqlParameter("String", reviewStatus),
      SqlParameter("Int", fileId.toString)
    )))

    startTransaction {
      for {
        _ <- writeDBList(sql, params)
      } yield "File review status updated successfully"
    }
  }