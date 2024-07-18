package Impl

import cats.effect.IO
import cats.implicits._  // 添加这行导入
import Common.API.{PlanContext, Planner}
import Common.DBAPI._
import Common.ServiceUtils.schemaName
import APIs.LiveStreamAPI.{GetAllLiveStreamsMessage, LiveStreamInfo}
import io.circe.generic.auto._
import io.circe.syntax._

case class GetAllLiveStreamsMessagePlanner(
                                            message: GetAllLiveStreamsMessage,
                                            override val planContext: PlanContext
                                          ) extends Planner[List[LiveStreamInfo]]:

  override def plan(using PlanContext): IO[List[LiveStreamInfo]] = {
    val readMessage = ReadDBRowsMessage(
      s"""
         |SELECT id, name, classroom, teacher, slot
         |FROM ${schemaName}.live_streams
      """.stripMargin,
      List()
    )

    readMessage.asJson.as[ReadDBRowsMessage].fold(
      error => IO.raiseError(new Exception(s"Failed to encode ReadDBRowsMessage: ${error.getMessage}")),
      encodedMessage => encodedMessage.send.attempt.flatMap {
        case Right(rows) =>
          IO.fromEither(
            rows.traverse { row =>
              for {
                id <- row.hcursor.get[String]("id")
                name <- row.hcursor.get[String]("name")
                classroom <- row.hcursor.get[String]("classroom")
                teacher <- row.hcursor.get[String]("teacher")
                slot <- row.hcursor.get[Int]("slot")
              } yield LiveStreamInfo(id, name, classroom, teacher, slot)
            }
          )
        case Left(error) =>
          IO.raiseError(new Exception(s"Failed to get live streams: ${error.getMessage}"))
      }
    )
  }