package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.ReadDBRowsMessage
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.DoctorAPI.{DoctorQueryMessage, DoctorInfo}
import cats.effect.IO
import io.circe.generic.auto._
import io.circe.parser._

case class DoctorQueryMessagePlanner(doctorName: String, override val planContext: PlanContext) extends Planner[DoctorInfo]:
  override def plan(using PlanContext): IO[DoctorInfo] = {
    val readMessage = ReadDBRowsMessage(
      s"""
         |SELECT user_name, bio, followers, following, review_count
         |FROM ${schemaName}.doctors
         |WHERE user_name = ?
      """.stripMargin,
      List(SqlParameter("String", doctorName))
    )

    readMessage.send.flatMap { rows =>
      rows.headOption match {
        case Some(row) =>
          IO.fromEither(for {
            userName <- row.hcursor.get[String]("userName")  // 注意这里使用 "userName" 而不是 "user_name"
            bio <- row.hcursor.get[String]("bio")
            followers <- row.hcursor.get[Int]("followers")
            following <- row.hcursor.get[Int]("following")
            reviewCount <- row.hcursor.get[Int]("reviewCount")  // 注意这里使用 "reviewCount" 而不是 "review_count"
          } yield DoctorInfo(userName, Some(bio), followers, following, reviewCount))
        case None =>
          IO.raiseError(new Exception("Doctor not found"))
      }
    }
  }